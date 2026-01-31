import { useState, useEffect } from "react";

interface Agent {
  id: string;
  name: string;
  api_key: string;
  permissions: string[];
}

export function GatewayView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [newAgentName, setNewAgentName] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [createdAgent, setCreatedAgent] = useState<Agent | null>(null);

  const [isConnected, setIsConnected] = useState(false);

  // Fetch Agents
  const fetchAgents = async () => {
    try {
      const res = await fetch("http://localhost:8080/v1/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch (e) {
      console.error("Failed to fetch agents - Gateway likely offline", e);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000); // Poll for availability
    return () => clearInterval(interval);
  }, []);

  // WebSocket for Live Events
  useEffect(() => {
    let ws: WebSocket | null = null;

    if (isConnected) {
      ws = new WebSocket("ws://localhost:8080/v1/events");

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setEvents((prev) => [data, ...prev].slice(0, 50));
        } catch (e) {
          console.error("WS Parse Error", e);
        }
      };
    }

    return () => {
      if (ws) ws.close();
    };
  }, [isConnected]);

  const handleCreateAgent = async () => {
    try {
      const res = await fetch("http://localhost:8080/v1/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAgentName }),
      });

      if (res.ok) {
        // Real backend response usage
        await fetchAgents();
        setNewAgentName("");
        setShowAddModal(false);
      }
    } catch (e) {
      alert("Failed to create agent");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[550px] mt-8">
      {/* Agent Manager */}
      <div className="bg-plexus-card backdrop-blur-md border border-plexus-border rounded-2xl p-6 relative overflow-hidden flex flex-col shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-sm font-bold text-plexus-cyan uppercase tracking-widest flex items-center">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            Registered Agents
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!isConnected}
            className={`px-3 py-1.5 text-xs font-bold uppercase rounded transition-colors ${isConnected ? "bg-plexus-cyan/10 text-plexus-cyan hover:bg-plexus-cyan/20" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}
          >
            + New Agent
          </button>
        </div>

        {!isConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            </div>
            <h3 className="text-white font-bold text-sm mb-1">
              Gateway Offline
            </h3>
            <p className="text-xs text-plexus-muted max-w-[200px]">
              Ensure <code>plexus-gateway</code> is running on port 8080 to
              manage agents.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto custom-scrollbar space-y-3">
            {agents.length === 0 ? (
              <div className="text-center text-plexus-muted text-xs mt-10">
                No external agents registered.
              </div>
            ) : (
              agents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-plexus-dark/30 border border-plexus-border/50 rounded-lg p-3"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-white text-sm">
                      {agent.name}
                    </span>
                    <span className="text-[10px] bg-plexus-green/20 text-plexus-green px-1.5 rounded">
                      ACTIVE
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-plexus-muted truncate">
                    ID: {agent.id}
                  </div>
                  <div className="font-mono text-[10px] text-plexus-muted truncate">
                    Key: ••••••••••••{agent.api_key.slice(-4)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Live Monitor */}
      <div className="bg-plexus-card backdrop-blur-md border border-plexus-border rounded-2xl p-0 relative overflow-hidden flex flex-col shadow-lg">
        <div className="px-6 py-4 border-b border-plexus-border bg-plexus-dark/50 flex justify-between items-center">
          <h2 className="text-sm font-bold text-plexus-cyan uppercase tracking-widest flex items-center">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Gateway Events
          </h2>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] text-plexus-muted font-mono uppercase">
              LIVE
            </span>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-auto custom-scrollbar font-mono text-xs bg-[#0a0a0a]">
          {events.map((evt, i) => (
            <div
              key={i}
              className="mb-2 break-all border-l-2 border-plexus-border pl-2 hover:border-plexus-cyan transition-colors"
            >
              <span className="text-plexus-muted">
                [{new Date().toLocaleTimeString()}]
              </span>{" "}
              <span className="text-plexus-green">{evt.type}</span>:{" "}
              <span className="text-gray-400">
                {JSON.stringify(evt.data || evt.msg)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Add Agent Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-plexus-card border border-plexus-border p-6 rounded-2xl w-96 shadow-2xl animate-in zoom-in">
            {createdAgent ? (
              <>
                <h3 className="text-lg font-bold text-white mb-4">
                  Agent Created!
                </h3>
                <div className="bg-plexus-dark/50 p-4 rounded-lg mb-4 border border-plexus-green/30">
                  <p className="text-xs text-plexus-muted uppercase font-bold mb-1">
                    API Key (Copy Now)
                  </p>
                  <p className="font-mono text-sm text-plexus-cyan break-all select-all">
                    {createdAgent.api_key}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setCreatedAgent(null);
                  }}
                  className="w-full py-2 bg-plexus-green text-black font-bold uppercase rounded-lg"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white mb-4">
                  Register New Agent
                </h3>
                <input
                  type="text"
                  placeholder="Agent Name (e.g. Moltbot)"
                  className="w-full bg-plexus-dark/50 border border-plexus-border rounded-lg p-3 text-white mb-4 outline-none focus:border-plexus-cyan"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                />
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-plexus-muted font-bold text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateAgent}
                    className="px-4 py-2 bg-plexus-cyan text-black font-bold text-xs uppercase rounded-lg"
                  >
                    Create
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
