import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface DashboardViewProps {
  status: any;
  meshState: any[];
}

export function DashboardView({ status, meshState }: DashboardViewProps) {
  const [systemPromptInput, setSystemPromptInput] = useState(
    "You are a helpful AI assistant.",
  );
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [tps, setTps] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMeshMap, setShowMeshMap] = useState(false);

  const responseRef = useRef("");
  const startTimeRef = useRef<number | null>(null);
  const tokenCountRef = useRef(0);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioInputRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioDataRef = useRef<number[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Listen for Streaming Events
  useEffect(() => {
    const setupListeners = async () => {
      const unlistenToken = await listen<string>(
        "ai-response-token",
        (event) => {
          if (startTimeRef.current === null) {
            startTimeRef.current = Date.now();
          }
          tokenCountRef.current += 1;

          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          if (elapsed > 0.5) {
            setTps(parseFloat((tokenCountRef.current / elapsed).toFixed(1)));
          }

          responseRef.current += event.payload;
          setResponse(responseRef.current);
        },
      );

      const unlistenComplete = await listen("ai-response-complete", () => {
        setLoading(false);
        if (startTimeRef.current && tokenCountRef.current > 0) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          if (elapsed > 0)
            setTps(parseFloat((tokenCountRef.current / elapsed).toFixed(1)));
        }
      });

      return () => {
        unlistenToken();
        unlistenComplete();
      };
    };

    const unlistenPromise = setupListeners();
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const drawVisualizer = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#2ae876";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#2ae876";
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    animationFrameRef.current = requestAnimationFrame(drawVisualizer);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      audioInputRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const channel = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < channel.length; i++) {
          audioDataRef.current.push(channel[i]);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      processorRef.current = processor;

      setIsRecording(true);
      audioDataRef.current = [];
      drawVisualizer();
    } catch (e) {
      console.error("Mic Error:", e);
      alert("Microphone access failed. Ensure permission is granted.");
    }
  };

  const stopRecording = async () => {
    if (!audioContextRef.current) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
    }
    if (audioInputRef.current) audioInputRef.current.disconnect();
    if (audioContextRef.current) await audioContextRef.current.close();

    setIsRecording(false);
    setLoading(true);

    try {
      const text = await invoke<string>("transcribe_audio", {
        audioData: audioDataRef.current,
      });
      setPrompt((prev) => (prev ? prev + " " : "") + text);
    } catch (e) {
      console.error(e);
      alert("Transcription Failed: " + e);
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    setResponse("");
    setTps(0);
    responseRef.current = "";
    startTimeRef.current = null;
    tokenCountRef.current = 0;
    try {
      await invoke("generate_prompt", { prompt });
    } catch (e) {
      setResponse(`Error: ${e}`);
      setLoading(false);
    }
  };

  const handleSaveSystemPrompt = async () => {
    if (!systemPromptInput) return;
    try {
      await invoke("set_system_prompt", { prompt: systemPromptInput });
      alert("System Prompt Updated! Chat History Cleared.");
      setShowSettings(false);
    } catch (e) {
      console.error(e);
      alert("Failed to update system prompt");
    }
  };

  return (
    <>
      {/* Mesh Map Modal */}
      {showMeshMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-plexus-card border border-plexus-border p-6 rounded-2xl w-[600px] shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <span className="w-2 h-2 bg-plexus-green rounded-full mr-3 animate-pulse"></span>
              Neural Mesh Topology
            </h3>

            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              {meshState.length === 0 ? (
                <p className="text-plexus-muted text-sm">
                  Scanning for peers...
                </p>
              ) : (
                meshState.map((node) => (
                  <div
                    key={node.peer_id}
                    className="bg-plexus-dark/40 border border-plexus-border/50 rounded-xl p-4 flex justify-between items-center group
                  hover:border-plexus-cyan/50 hover:bg-plexus-cyan/5 transition-all"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <div className="font-mono text-xs text-plexus-cyan">
                          {node.peer_id.substring(0, 16)}...
                        </div>
                        {node.peer_id === status?.peer_id && (
                          <span className="text-[10px] bg-plexus-green/20 text-plexus-green px-1.5 rounded">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-plexus-muted mt-1 uppercase tracking-wider">
                        {node.capabilities.cpu_cores} Cores •{" "}
                        {(
                          node.capabilities.total_memory /
                          1024 /
                          1024 /
                          1024
                        ).toFixed(1)}{" "}
                        GB RAM
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-xs font-bold ${node.capabilities.model_loaded ? "text-plexus-green" : "text-plexus-muted"}`}
                      >
                        {node.capabilities.model_loaded
                          ? "MODEL ONLINE"
                          : "IDLE"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowMeshMap(false)}
                className="px-4 py-2 bg-plexus-dark border border-plexus-border text-white text-xs font-bold uppercase rounded-lg hover:border-plexus-cyan transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-plexus-card border border-plexus-border p-6 rounded-2xl w-96 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-white mb-4">
              System Settings
            </h3>
            <label className="block text-xs uppercase text-plexus-muted font-bold mb-2">
              System Instructions (Persona)
            </label>
            <textarea
              className="w-full bg-plexus-dark/50 border border-plexus-border rounded-lg p-3 text-sm text-white focus:border-plexus-cyan outline-none resize-none mb-4 h-32"
              value={systemPromptInput}
              onChange={(e) => setSystemPromptInput(e.target.value)}
            />

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(false);
                }}
                className="px-4 py-2 text-xs font-bold uppercase text-plexus-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveSystemPrompt();
                }}
                className="px-4 py-2 bg-plexus-cyan text-black text-xs font-bold uppercase rounded-lg hover:bg-plexus-cyan/80 transition-colors"
              >
                Save & Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Controls (Settings / Mesh Map) */}
      <div className="absolute top-6 right-6 flex items-center space-x-4 z-50">
        <button
          onClick={() => setShowSettings(true)}
          className="text-plexus-muted hover:text-plexus-cyan transition-colors"
          title="Configure System Prompt"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
        <div className="h-8 w-[1px] bg-plexus-border"></div>
        <div
          className="text-right cursor-pointer group"
          onClick={() => setShowMeshMap(true)}
        >
          <p className="text-[10px] text-plexus-muted uppercase tracking-widest font-semibold mb-1 group-hover:text-plexus-cyan transition-colors">
            Mesh Peers
          </p>
          <div className="flex items-center justify-end space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${status && status.connected_peers > 0 ? "bg-plexus-green shadow-[0_0_8px_#2ae876]" : "bg-plexus-muted"}`}
            ></span>
            <span className="text-lg font-bold text-white group-hover:text-plexus-cyan transition-colors">
              {meshState.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[550px] mt-8">
        {/* Input Console */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <div className="bg-plexus-card backdrop-blur-md border border-plexus-border rounded-2xl flex-1 p-1 flex flex-col group transition-all hover:border-plexus-cyan/30 shadow-lg">
            <div className="bg-plexus-dark/40 flex-1 rounded-xl p-5 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-logo-gradient opacity-100"></div>

              <div className="flex justify-between items-center mb-4">
                <label className="text-xs font-bold text-plexus-cyan uppercase tracking-widest flex items-center">
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
                  Prompt Injection
                </label>

                {/* Voice Input Button */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-2 rounded-full transition-all duration-300 ${
                    isRecording
                      ? "bg-red-500/20 text-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                      : "bg-plexus-dark text-plexus-muted hover:text-plexus-cyan hover:bg-plexus-cyan/10"
                  }`}
                  title={isRecording ? "Stop Recording" : "Voice Input"}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>
              </div>

              {/* Visualizer Canvas */}
              <div
                className={`transition-all duration-300 overflow-hidden ${isRecording ? "h-16 mb-4 opacity-100" : "h-0 opacity-0"}`}
              >
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={60}
                  className="w-full h-full bg-plexus-dark/30 rounded border border-plexus-cyan/20"
                ></canvas>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter text string for distributed processing..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-plexus-text resize-none font-mono text-sm placeholder-plexus-muted/40 leading-relaxed"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt}
            className={`w-full py-4 rounded-xl font-bold uppercase tracking-[0.2em] text-sm transition-all duration-300 relative overflow-hidden group ${
              loading
                ? "bg-plexus-border text-plexus-muted cursor-not-allowed"
                : "text-white shadow-lg shadow-plexus-cyan/20"
            }`}
          >
            {!loading && (
              <div className="absolute inset-0 bg-logo-gradient opacity-100 group-hover:opacity-90 transition-opacity"></div>
            )}

            <span className="relative z-10 flex items-center justify-center">
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Computing...
                </>
              ) : (
                "Transmit Signal"
              )}
            </span>
          </button>
        </div>

        {/* Visualization / Output Area */}
        <div className="lg:col-span-8 bg-plexus-card backdrop-blur-md border border-plexus-border rounded-2xl p-0 relative overflow-hidden flex flex-col shadow-2xl">
          {/* Terminal Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-plexus-border bg-plexus-dark/50">
            <h2 className="text-xs font-bold text-plexus-muted uppercase tracking-widest flex items-center">
              Output Stream
              {tps > 0 && (
                <span className="ml-4 text-plexus-cyan bg-plexus-cyan/10 px-2 py-0.5 rounded text-[10px] shadow-[0_0_10px_rgba(0,220,236,0.2)]">
                  TPS: {tps}
                </span>
              )}
            </h2>
            <div className="flex space-x-2">
              <div className="w-2 h-2 rounded-full bg-plexus-green opacity-50"></div>
              <div className="w-2 h-2 rounded-full bg-plexus-cyan opacity-50"></div>
              <div className="w-2 h-2 rounded-full bg-plexus-blue opacity-50"></div>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-auto custom-scrollbar font-mono text-sm leading-7 text-gray-300 relative">
            {/* Scanline effect */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 pointer-events-none bg-[length:100%_4px,3px_100%]"></div>

            {response ? (
              <div className="relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center text-plexus-green mb-2 opacity-70 text-xs">
                  <span>RECEIVED PACKET</span>
                  <div className="flex-1 h-[1px] bg-plexus-green/20 ml-3"></div>
                </div>
                <p className="whitespace-pre-wrap text-plexus-text drop-shadow-[0_0_2px_rgba(0,0,0,0.5)]">
                  {response}
                </p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-plexus-muted/20 relative z-10">
                <div className="w-24 h-24 border border-plexus-border rounded-full flex items-center justify-center mb-4 relative">
                  <div className="absolute inset-0 rounded-full border border-plexus-cyan/20 animate-ping opacity-20"></div>
                  <div className="w-2 h-2 bg-plexus-cyan rounded-full"></div>
                </div>
                <p className="font-mono text-xs uppercase tracking-widest">
                  Awaiting Transmission
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
