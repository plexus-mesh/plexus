import { motion } from "framer-motion";
import { QrCode, Smartphone, RefreshCw, CheckCircle2 } from "lucide-react";
import { usePairing } from "../hooks/usePairing";
import { QRCodeCanvas } from "qrcode.react";

export default function ScanToMesh() {
  // Logic extracted to custom hook -> Separation of Concerns
  const { isPaired, pairedDevice, startScanning, pairingCode } = usePairing();

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 rounded-3xl max-w-sm w-full flex flex-col items-center gap-6"
      >
        {!isPaired ? (
          <>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                Add a Device
              </h2>
              <p className="text-sm text-muted-foreground">
                Scan this code with the Plexus Mobile App to instantly pair.
              </p>
            </div>

            {/* Interactive Element with Keyboard Accessibility */}
            <div
              className="relative group cursor-pointer focus:outline-none"
              onClick={startScanning}
              aria-label="Click to simulate scanning"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && startScanning()}
            >
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-all duration-500" />
              <div className="relative bg-white p-4 rounded-xl">
                {pairingCode ? (
                  <QRCodeCanvas
                    value={pairingCode}
                    size={192}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="H"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <QrCode className="w-48 h-48 text-black/20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-black font-bold uppercase tracking-widest bg-white/80 px-2 py-1 rounded">
                        Click to Generate
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Smartphone size={14} />
              <span>
                {pairingCode
                  ? "Waiting for mobile scan..."
                  : "Click QR to generate code"}
              </span>
              {pairingCode && (
                <RefreshCw size={14} className="animate-spin ml-2" />
              )}
            </div>
          </>
        ) : (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-4 py-12"
          >
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 border border-green-500/50 shadow-[0_0_20px_rgba(74,222,128,0.2)]">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-xl font-bold">Device Paired</h3>
            <p className="text-muted-foreground text-sm">
              {pairedDevice} added to mesh.
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
