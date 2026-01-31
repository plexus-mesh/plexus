import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, Cpu, Server, ShieldCheck } from "lucide-react";

interface Step {
  id: number;
  title: string;
  description: string;
}

const steps: Step[] = [
  { id: 1, title: "Welcome", description: "Initialize your secure node." },
  {
    id: 2,
    title: "Hardware Check",
    description: "Scanning local capabilities...",
  },
  { id: 3, title: "Network", description: "Bootstrapping P2P mesh..." },
  { id: 4, title: "Ready", description: "You are now part of the mesh." },
];

export default function OnboardingWizard({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [hardwareStatus, setHardwareStatus] = useState<
    "idle" | "scanning" | "success"
  >("idle");
  const [hardwareInfo, setHardwareInfo] = useState<{
    cpu_model: String;
    total_memory_gb: number;
    cpu_cores: number;
  } | null>(null);

  useEffect(() => {
    if (currentStep === 2) {
      setHardwareStatus("scanning");
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("check_hardware")
          .then((info: any) => {
            setHardwareInfo(info);
            setHardwareStatus("success");
          })
          .catch((err) => {
            console.error("Hardware check failed", err);
            // Fallback logic could go here
            setHardwareStatus("success");
          });
      });
    }
  }, [currentStep]);

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent text-white p-8 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-background via-background to-black pointer-events-none -z-20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 animate-pulse-neon" />

      <div className="w-full max-w-md glass-card rounded-2xl p-8 border border-white/5 relative">
        <div className="flex justify-between mb-8">
          {steps.map((step) => (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full transition-all duration-500 ${step.id <= currentStep ? "bg-primary shadow-[0_0_10px_theme('colors.primary.DEFAULT')]" : "bg-white/20"}`}
              />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center space-y-6"
          >
            {currentStep === 1 && (
              <>
                <img
                  src="/logo.png"
                  alt="Plexus Logo"
                  className="w-24 h-24 rounded-full shadow-2xl mb-4"
                />
                <h1 className="text-3xl font-bold tracking-tight">
                  Welcome to Plexus
                </h1>
                <p className="text-muted-foreground">
                  The first decentralized AI mesh. Private. Powerful. Yours.
                </p>
              </>
            )}

            {currentStep === 2 && (
              <>
                <div className="relative">
                  <Cpu
                    className={`w-16 h-16 text-primary ${hardwareStatus === "scanning" ? "animate-pulse" : ""}`}
                  />
                  {hardwareStatus === "success" && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -bottom-2 -right-2 bg-green-500 text-black rounded-full p-1 border-2 border-background"
                    >
                      <Check size={16} />
                    </motion.div>
                  )}
                </div>
                <h2 className="text-2xl font-semibold">Analyzing Hardware</h2>
                <div className="w-full bg-secondary/50 rounded-full h-2 overflow-hidden relative">
                  {hardwareStatus === "scanning" && (
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2 }}
                    />
                  )}
                  {hardwareStatus === "success" && (
                    <div className="h-full bg-primary w-full" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {hardwareStatus === "scanning" ? (
                    "Detecting System Capabilities..."
                  ) : hardwareInfo ? (
                    <>
                      <span className="block font-mono text-xs mb-1">
                        {hardwareInfo.cpu_model}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {hardwareInfo.cpu_cores} Cores •{" "}
                        {hardwareInfo.total_memory_gb} GB RAM
                      </span>
                    </>
                  ) : (
                    "Unknown Hardware"
                  )}
                </p>
              </>
            )}

            {currentStep === 3 && (
              <>
                <Server className="w-16 h-16 text-blue-400 animate-bounce" />
                <h2 className="text-2xl font-semibold">Connecting to Mesh</h2>
                <p className="text-muted-foreground">
                  Establishing secure P2P channels...
                </p>
              </>
            )}

            {currentStep === 4 && (
              <>
                <ShieldCheck className="w-16 h-16 text-green-400" />
                <h2 className="text-2xl font-semibold">You are Online</h2>
                <p className="text-muted-foreground">
                  Your node is active and ready to serve.
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex justify-end">
          <button
            onClick={nextStep}
            disabled={currentStep === 2 && hardwareStatus !== "success"}
            className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentStep === steps.length ? "Finish" : "Continue"}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
