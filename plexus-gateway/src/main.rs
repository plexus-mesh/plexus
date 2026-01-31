use axum::extract::ws::{Message as WsMessage, WebSocket, WebSocketUpgrade};
use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use axum_extra::{headers, TypedHeader};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::{info, warn};

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Event Bus (Broadcast)
    let (tx, _rx) = tokio::sync::broadcast::channel(100);

    // App State
    let shared_state = Arc::new(AppState {
        agents: std::sync::Mutex::new(std::collections::HashMap::new()),
        tx: tx.clone(),
    });

    // Start background event emitter (Real Mesh Events - Stub)
    // TODO: Connect to Redis/ZMQ for real mesh events
    let _tx_clone = tx.clone();
    /*
    tokio::spawn(async move {
        // Placeholder for real event ingestion
    });
    */

    // Build Router
    let app = Router::new()
        .route("/v1/chat/completions", post(chat_completions))
        .route("/v1/agents/register", post(register_agent))
        .route("/v1/agents", get(list_agents))
        .route("/v1/events", get(ws_handler))
        .route("/health", get(health_check))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(shared_state);

    let port = 8080;
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    info!("Plexus Gateway listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> &'static str {
    "OK"
}

// --- App State ---

struct AppState {
    // Map API Key -> Agent
    agents: std::sync::Mutex<std::collections::HashMap<String, Agent>>,
    // Broadcast channel for events
    tx: tokio::sync::broadcast::Sender<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Agent {
    id: String,
    name: String,
    api_key: String,
    permissions: Vec<String>,
}

// --- Data Structures ---

#[derive(Debug, Deserialize)]
struct RegisterAgentRequest {
    name: String,
}

#[derive(Debug, Serialize)]
struct RegisterAgentResponse {
    agent_id: String,
    api_key: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<Message>,
    #[serde(default)]
    temperature: Option<f32>,
    #[serde(default)]
    stream: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionResponse {
    id: String,
    object: String,
    created: u64,
    model: String,
    choices: Vec<Choice>,
    usage: Usage,
}

#[derive(Debug, Serialize)]
struct Choice {
    index: usize,
    message: Message,
    finish_reason: String,
}

#[derive(Debug, Serialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

// --- WS Handlers ---

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>) {
    let mut rx = state.tx.subscribe();

    // Send welcome message
    // .into() converts String -> axum::body::Bytes (Utf8Bytes compatible)
    if socket
        .send(WsMessage::Text(
            serde_json::json!({"type": "connected", "msg": "Welcome to Plexus Mesh Events"})
                .to_string()
                .into(),
        ))
        .await
        .is_err()
    {
        return;
    }

    loop {
        tokio::select! {
            Ok(msg) = rx.recv() => {
                if socket.send(WsMessage::Text(msg.into())).await.is_err() {
                    break;
                }
            }
            // Ignore incoming messages for now, just a push stream
            _ = socket.recv() => {}
        }
    }
}

// --- HTTP Handlers ---

async fn list_agents(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let agents = state.agents.lock().unwrap();
    let agents_list: Vec<Agent> = agents.values().cloned().collect();
    (StatusCode::OK, Json(agents_list))
}

async fn register_agent(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterAgentRequest>,
) -> impl IntoResponse {
    let agent_id = uuid::Uuid::new_v4().to_string();
    let api_key = format!("sk-plexus-{}", uuid::Uuid::new_v4());

    let agent = Agent {
        id: agent_id.clone(),
        name: payload.name,
        api_key: api_key.clone(),
        permissions: vec!["compute".to_string()],
    };

    {
        let mut agents = state.agents.lock().unwrap();
        agents.insert(api_key.clone(), agent);
    }

    info!("Registered new agent: {} ({})", agent_id, api_key);

    (
        StatusCode::CREATED,
        Json(RegisterAgentResponse { agent_id, api_key }),
    )
}

// --- Error Handling ---

#[derive(Debug)]
struct AppError(StatusCode, String);

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        (self.0, Json(serde_json::json!({"error": self.1}))).into_response()
    }
}

// Implement From for our stub error tuple (to make ? work)
impl From<(StatusCode, Json<serde_json::Value>)> for AppError {
    fn from(inner: (StatusCode, Json<serde_json::Value>)) -> Self {
        // Extract string from Json value for simplicity or just use generic error
        AppError(inner.0, inner.1 .0.to_string())
    }
}

async fn chat_completions(
    State(state): State<Arc<AppState>>,
    TypedHeader(auth): TypedHeader<headers::Authorization<headers::authorization::Bearer>>,
    Json(payload): Json<ChatCompletionRequest>,
) -> Result<impl IntoResponse, AppError> {
    // Authentication
    let api_key = auth.token();
    let agent_name = {
        let agents = state.agents.lock().unwrap();
        match agents.get(api_key) {
            Some(agent) => agent.name.clone(),
            None => {
                return Err(AppError(
                    StatusCode::UNAUTHORIZED,
                    "Invalid API Key".to_string(),
                ));
            }
        }
    };

    info!(
        "Received chat completion request from '{}' for model: {}",
        agent_name, payload.model
    );

    // Dispatch to Mesh (Stub)
    // We map the tuple error to AppError
    let response_text = dispatch_to_mesh(&payload)
        .await
        .map_err(|(status, json)| AppError(status, json.0.to_string()))?;

    let response = ChatCompletionResponse {
        id: format!("chatcmpl-{}", uuid::Uuid::new_v4()),
        object: "chat.completion".to_string(),
        created: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        model: payload.model.clone(),
        choices: vec![Choice {
            index: 0,
            message: Message {
                role: "assistant".to_string(),
                content: response_text,
            },
            finish_reason: "stop".to_string(),
        }],
        usage: Usage {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        },
    };

    Ok((StatusCode::OK, Json(response)))
}

// Internal Logic
async fn dispatch_to_mesh(
    _req: &ChatCompletionRequest,
) -> Result<String, (StatusCode, Json<serde_json::Value>)> {
    // TODO: Implement actual gRPC or P2P client here.
    // For MVP, we return 503 to indicate this Gateway is not yet connected to a backing node.

    // If we wanted to keep the demo logic, we'd flag it.
    // But for "Release Ready", we should be honest.

    warn!("Gateway received request but has no active mesh uplink.");
    Err((
        StatusCode::SERVICE_UNAVAILABLE,
        Json(serde_json::json!({
            "error": {
                "message": "Mesh Uplink Unavailable. Please check plexus-node connection.",
                "type": "server_error",
                "code": 503
            }
        })),
    ))
}
