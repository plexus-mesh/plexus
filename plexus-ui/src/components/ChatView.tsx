import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Send, Bot, RefreshCw, Mic, MoreVertical } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for streaming tokens
  useEffect(() => {
    const unlistenToken = listen("ai-response-token", (event) => {
      const token = event.payload as string;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + token },
          ];
        }
        return [
          ...prev,
          { role: "assistant", content: token, timestamp: Date.now() },
        ];
      });
    });

    const unlistenComplete = listen("ai-response-complete", () => {
      setIsThinking(false);
    });

    return () => {
      unlistenToken.then((f) => f());
      unlistenComplete.then((f) => f());
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg: Message = {
      role: "user",
      content: input,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    try {
      // Note: In a real app, we'd also create a placeholder assistant message here if needed
      // But the stream listener handles the first token creation
      await invoke("generate_prompt", { prompt: input });
    } catch (e) {
      console.error("Failed to send prompt:", e);
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${e}`, timestamp: Date.now() },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-md rounded-xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 bg-white/5">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Plexus Intelligence</h2>
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] text-muted-foreground">
                TinyLlama-1.1B Online
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setMessages([])}
            className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground transition-all"
            title="Clear Chat"
          >
            <RefreshCw size={16} />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground transition-all">
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-4">
            <Bot size={48} className="mb-2" />
            <h3 className="text-lg font-medium">How can I help you today?</h3>
            <p className="text-sm max-w-xs">
              I can answer questions, write code, or control your mesh nodes.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-none"
                  : "bg-white/5 text-foreground border border-white/5 rounded-tl-none"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <span
                className={`block text-[9px] mt-1 opacity-50 ${msg.role === "user" ? "text-primary-foreground" : "text-muted-foreground"}`}
              >
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-none px-4 py-3 flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce delay-0"></div>
              <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce delay-150"></div>
              <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce delay-300"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black/20 border-t border-white/5">
        <div className="relative flex items-center">
          <div className="absolute left-3 z-10 text-muted-foreground">
            <Mic
              size={18}
              className="cursor-pointer hover:text-white transition-colors"
            />
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
            disabled={isThinking}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isThinking}
            className="absolute right-2 p-1.5 bg-primary rounded-full text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="text-center mt-2">
          <p className="text-[10px] text-muted-foreground/40">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
