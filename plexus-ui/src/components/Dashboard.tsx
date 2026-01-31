import {} from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

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

interface DashboardProps {
  meshState: Heartbeat[];
  localPeerId?: string;
}

export default function Dashboard({ meshState, localPeerId }: DashboardProps) {
  // Generate nodes based on meshState + Local Node
  const nodes = [
    // Local Node (Always center)
    {
      id: localPeerId || "local",
      position: { x: 0, y: 0 },
      data: {
        label: localPeerId
          ? `Valiant (Self)\n${localPeerId.substring(0, 8)}...`
          : "Initializing...",
      },
      type: "input",
      style: {
        background: "#030712",
        color: "#fff",
        border: "1px solid #10b981",
        boxShadow: "0 0 20px rgba(16, 185, 129, 0.2)",
        width: 180,
        fontSize: "12px",
        fontFamily: "monospace",
      },
    },
    // Remote Peers
    ...meshState
      .filter((p) => p.peer_id !== localPeerId)
      .map((peer, index) => ({
        id: peer.peer_id,
        position: {
          x: (index % 2 === 0 ? -200 : 200) * (Math.floor(index / 2) + 1), // Simple distribution
          y: 150 * (Math.floor(index / 2) + 1),
        },
        data: {
          label: `Peer ${index + 1}\n${peer.peer_id.substring(0, 8)}...\n${peer.capabilities.cpu_cores} Cores\n${Math.round(peer.capabilities.total_memory / 1024 / 1024 / 1024)}GB RAM\nModel: ${peer.model || "Unknown"}`,
        },
        style: {
          background: "#111827",
          color: "#9ca3af",
          border: "1px solid #374151",
          width: 160,
          fontSize: "11px",
          fontFamily: "monospace",
        },
      })),
  ];

  const edges = meshState
    .filter((p) => p.peer_id !== localPeerId)
    .map((peer) => ({
      id: `e-${localPeerId}-${peer.peer_id}`,
      source: localPeerId || "local",
      target: peer.peer_id,
      animated: true,
      style: { stroke: "#10b981", strokeWidth: 2 },
    }));

  // Sync state when props change
  // Note: In production, use useEffect to sync prop changes to internal state properly
  // For this demo, we'll force update via key or assume re-render handles it if passed directly
  // Ideally:
  /*
    useEffect(() => {
        setNodes(nodes);
        setEdges(edges);
    }, [meshState, localPeerId]);
    */

  // React Flow handles prop updates cleanly if node IDs are stable.
  // The previous 'key' hack forced a full re-mount which is jarring.

  return (
    <div className="w-full h-full min-h-[500px] bg-background text-foreground rounded-xl border border-white/10 overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Mesh Topology
        </h1>
        <p className="text-muted-foreground text-sm">
          Live visualization of {meshState.length} active nodes.
        </p>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        className="bg-background"
        proOptions={{ hideAttribution: true }}
        panOnScroll
        selectionOnDrag
        panOnDrag
        zoomOnPinch
        zoomOnScroll
        colorMode="dark"
      >
        <Controls className="bg-card text-foreground border-border" />
        <MiniMap
          className="bg-card border-border"
          nodeColor={(n) => (n.id === localPeerId ? "#10b981" : "#3b82f6")}
        />
        <Background color="#333" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
