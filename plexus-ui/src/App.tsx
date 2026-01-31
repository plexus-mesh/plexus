import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
// import { DashboardView } from "./components/DashboardView"; // Legacy
import { GatewayView } from "./components/GatewayView";
import OnboardingWizard from "./components/OnboardingWizard";
import Dashboard from "./components/Dashboard";
import ScanToMesh from "./components/ScanToMesh";
import { ChatView } from "./components/ChatView";
import { LayoutDashboard, Network, QrCode, MessageSquare } from "lucide-react";
import { useDeviceType } from "./hooks/useDeviceType";

// Interface for Node Status
interface NodeStatus {
  peer_id: string;
  connected_peers: number;
}

interface NodeCapabilities {
  cpu_cores: number;
  total_memory: number;
  gpu_info: string | null;
  model_loaded: boolean;
}

interface Heartbeat {
  peer_id: string;
  model: string;
  capabilities: NodeCapabilities;
  timestamp: number;
}

type View = "dashboard" | "gateway" | "pairing" | "chat";

function App() {
  const [status, setStatus] = useState<NodeStatus | null>(null);
  const [meshState, setMeshState] = useState<Heartbeat[]>([]);

  // Demo State: Reset this to false to test onboarding
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(() => {
    return localStorage.getItem("plexus_onboarded") === "true";
  });

  const [currentView, setCurrentView] = useState<View>("dashboard");
  const { isMobile } = useDeviceType();

  // Poll status every 5 seconds (Global Status)
  useEffect(() => {
    if (!hasOnboarded) return;

    const fetchStatus = async () => {
      try {
        const s = await invoke<NodeStatus>("get_node_status");
        setStatus(s);

        const m = await invoke<Heartbeat[]>("get_mesh_state");
        setMeshState(m);
      } catch (e) {
        console.warn("Failed to fetch status (Backend might be offline):", e);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [hasOnboarded]);

  const handleOnboardingComplete = () => {
    localStorage.setItem("plexus_onboarded", "true");
    setHasOnboarded(true);
  };

  if (!hasOnboarded) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden flex-col md:flex-row">
      {/* Sidebar (Desktop) */}
      {!isMobile && (
        <aside className="w-64 glass border-r border-white/5 flex flex-col p-4 space-y-8 z-20">
          <div className="flex items-center space-x-3 px-2">
            <img
              src="/logo.png"
              alt="Plexus Logo"
              className="w-10 h-10 rounded-full shadow-lg shadow-primary/20"
            />
            <div>
              <h1 className="font-bold tracking-tight text-lg">PLEXUS</h1>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase">
                My Grid
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            <button
              onClick={() => setCurrentView("dashboard")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${currentView === "dashboard" ? "bg-primary/20 text-primary border border-primary/20" : "text-muted-foreground hover:bg-white/5 hover:text-white"}`}
            >
              <LayoutDashboard size={18} />
              <span>Topology</span>
            </button>
            <button
              onClick={() => setCurrentView("gateway")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${currentView === "gateway" ? "bg-primary/20 text-primary border border-primary/20" : "text-muted-foreground hover:bg-white/5 hover:text-white"}`}
            >
              <Network size={18} />
              <span>Gateway</span>
            </button>
            <button
              onClick={() => setCurrentView("pairing")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${currentView === "pairing" ? "bg-primary/20 text-primary border border-primary/20" : "text-muted-foreground hover:bg-white/5 hover:text-white"}`}
            >
              <QrCode size={18} />
              <span>Add Device</span>
            </button>
            <button
              onClick={() => setCurrentView("chat")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${currentView === "chat" ? "bg-primary/20 text-primary border border-primary/20" : "text-muted-foreground hover:bg-white/5 hover:text-white"}`}
            >
              <MessageSquare size={18} />
              <span>AI Chat</span>
            </button>
          </nav>

          <div className="p-4 bg-black/40 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Local Node</span>
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_theme('colors.green.500')]"></span>
            </div>
            <p className="font-mono text-xs truncate opacity-70">
              {status?.peer_id || "initializing..."}
            </p>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative bg-black flex flex-col h-full">
        {/* Ambient Backdrops */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="flex-1 relative p-4 md:p-6 overflow-hidden">
          {/* Header for Mobile */}
          {isMobile && (
            <div className="flex items-center justify-between mb-4 z-30 relative">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                  P
                </div>
                <span className="font-bold">Plexus</span>
              </div>
              <div className="flex items-center space-x-2 bg-black/40 px-3 py-1 rounded-full border border-white/10">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-[10px] font-mono opacity-70">
                  {status?.peer_id?.substring(0, 6) || "..."}
                </span>
              </div>
            </div>
          )}

          <div className="h-full w-full rounded-xl overflow-hidden glass border border-white/5">
            {currentView === "dashboard" && (
              <Dashboard meshState={meshState} localPeerId={status?.peer_id} />
            )}
            {currentView === "gateway" && <GatewayView />}
            {currentView === "pairing" && <ScanToMesh />}
            {currentView === "chat" && <ChatView />}
          </div>
        </div>

        {/* Bottom Navigation (Mobile) */}
        {isMobile && (
          <nav className="h-16 glass border-t border-white/10 flex items-center justify-around px-2 z-30 shrink-0 mb-safe">
            <button
              onClick={() => setCurrentView("dashboard")}
              className={`flex flex-col items-center justify-center space-y-1 p-2 ${currentView === "dashboard" ? "text-primary" : "text-muted-foreground"}`}
            >
              <LayoutDashboard size={20} />
              <span className="text-[10px]">Mesh</span>
            </button>
            <button
              onClick={() => setCurrentView("chat")}
              className={`flex flex-col items-center justify-center space-y-1 p-2 ${currentView === "chat" ? "text-primary" : "text-muted-foreground"}`}
            >
              <MessageSquare size={20} />
              <span className="text-[10px]">Chat</span>
            </button>
            <button
              onClick={() => setCurrentView("gateway")}
              className={`flex flex-col items-center justify-center space-y-1 p-2 ${currentView === "gateway" ? "text-primary" : "text-muted-foreground"}`}
            >
              <Network size={20} />
              <span className="text-[10px]">Gateway</span>
            </button>
            <button
              onClick={() => setCurrentView("pairing")}
              className={`flex flex-col items-center justify-center space-y-1 p-2 ${currentView === "pairing" ? "text-primary" : "text-muted-foreground"}`}
            >
              <QrCode size={20} />
              <span className="text-[10px]">Pair</span>
            </button>
          </nav>
        )}
      </main>
    </div>
  );
}

export default App;
