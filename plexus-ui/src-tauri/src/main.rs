// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use plexus_p2p::{Heartbeat, NodeCommand, NodeService, NodeStatus, SystemCapabilities};
use std::path::PathBuf;
use tauri::{Emitter, Manager, State}; // v2: emit is replaced by Emitter trait or emit_to
use tokio::sync::mpsc;

struct AppState {
    node_tx: mpsc::Sender<NodeCommand>,
}

#[tauri::command]
async fn get_node_status(state: State<'_, AppState>) -> Result<NodeStatus, String> {
    let (tx, mut rx) = mpsc::channel(1);
    state
        .node_tx
        .send(NodeCommand::GetStatus { respond_to: tx })
        .await
        .map_err(|e| e.to_string())?;

    rx.recv()
        .await
        .ok_or_else(|| "Node service closed".to_string())
}

#[tauri::command]
async fn generate_prompt(
    prompt: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let (tx, mut rx) = mpsc::channel(32); // Buffer size
    state
        .node_tx
        .send(NodeCommand::Generate {
            prompt,
            respond_to: tx,
        })
        .await
        .map_err(|e| e.to_string())?;

    // Spawn listener to forward tokens to frontend
    tauri::async_runtime::spawn(async move {
        while let Some(token) = rx.recv().await {
            // v2: emit payload to all
            let _ = app_handle.emit("ai-response-token", token);
        }
        let _ = app_handle.emit("ai-response-complete", ());
    });

    Ok(())
}

#[tauri::command]
async fn set_system_prompt(prompt: String, state: State<'_, AppState>) -> Result<(), String> {
    let (tx, mut rx) = mpsc::channel(1);
    state
        .node_tx
        .send(NodeCommand::SetSystemPrompt {
            prompt,
            respond_to: tx,
        })
        .await
        .map_err(|e| e.to_string())?;

    rx.recv()
        .await
        .ok_or_else(|| "Node service closed".to_string())
}

#[tauri::command]
async fn transcribe_audio(
    audio_data: Vec<f32>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let (tx, mut rx) = mpsc::channel(1);
    state
        .node_tx
        .send(NodeCommand::Transcribe {
            audio_data,
            respond_to: tx,
        })
        .await
        .map_err(|e| e.to_string())?;

    rx.recv()
        .await
        .ok_or_else(|| "Node service closed".to_string())
}

#[tauri::command]
async fn get_mesh_state(state: State<'_, AppState>) -> Result<Vec<Heartbeat>, String> {
    let (tx, mut rx) = mpsc::channel(1);
    state
        .node_tx
        .send(NodeCommand::GetMeshState { respond_to: tx })
        .await
        .map_err(|e| e.to_string())?;

    rx.recv()
        .await
        .ok_or_else(|| "Node service closed".to_string())
}

// New Real Data Commands
#[tauri::command]
async fn check_hardware(state: State<'_, AppState>) -> Result<SystemCapabilities, String> {
    let (tx, mut rx) = mpsc::channel(1);
    state
        .node_tx
        .send(NodeCommand::GetSystemInfo { respond_to: tx })
        .await
        .map_err(|e| e.to_string())?;

    rx.recv()
        .await
        .ok_or_else(|| "Node service closed".to_string())
}

#[tauri::command]
async fn start_pairing(state: State<'_, AppState>) -> Result<String, String> {
    let (tx, mut rx) = mpsc::channel(1);
    state
        .node_tx
        .send(NodeCommand::StartPairing { respond_to: tx })
        .await
        .map_err(|e| e.to_string())?;

    rx.recv()
        .await
        .ok_or_else(|| "Node service closed".to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let _app_handle = app.handle();

            // Spawn Node Service
            let (tx, rx) = mpsc::channel(32);

            // Manage state with actual sender
            println!("Main: Setting up AppState with NodeService channel...");
            app.manage(AppState { node_tx: tx });

            let app_dir = app.path().app_data_dir().unwrap_or(PathBuf::from("."));
            if !app_dir.exists() {
                let _ = std::fs::create_dir_all(&app_dir);
            }
            let identity_path = app_dir.join("identity.key");

            tauri::async_runtime::spawn(async move {
                // We need to handle the Result here to avoid checking unwrap/expect inside async block
                match NodeService::new(
                    identity_path,
                    rx,
                    "tinyllama".to_string(),
                    vec![],
                    Some(app_dir),
                )
                .await
                {
                    Ok(mut service) => {
                        // Service needs to be mutable to run
                        if let Err(e) = service.run().await {
                            eprintln!("Node service error: {}", e);
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize node service: {}", e);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_node_status,
            generate_prompt,
            set_system_prompt,
            transcribe_audio,
            get_mesh_state,
            check_hardware,
            start_pairing
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
