import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Interface for the Pair status.
 */
export interface PairingState {
  isPaired: boolean;
  pairedDevice: string | null;
  pairingCode: string | null;
  startScanning: () => void;
  reset: () => void;
}

/**
 * Custom hook to manage P2P Pairing Logic.
 * Separation of Concerns: This handles state and side-effects, leaving the UI to just render.
 */
export function usePairing(): PairingState {
  const [isPaired, setIsPaired] = useState(false);
  const [pairedDevice, setPairedDevice] = useState<string | null>(null);

  const [pairingCode, setPairingCode] = useState<string | null>(null);

  const startScanning = useCallback(async () => {
    try {
      const response = await invoke<string>("start_pairing");
      // Backend returns a JSON string now
      // We store the raw response as content for the QR code, or parse it if we need to display the code specifically.
      // But ScanToMesh expects 'pairingCode' to be the string to put in QR?
      // Actually ScanToMesh wraps it in another JSON. We should just pass the object.

      // Let's parse it to store in state appropriately.
      const parsed = JSON.parse(response);
      setPairingCode(response); // Store the full JSON string to pass to ScanToMesh?
      // No, ScanToMesh constructs its own JSON.
      // Let's store the full JSON response as the pairingCode for now,
      // and update ScanToMesh to just use it.
    } catch (e) {
      console.error("Pairing failed:", e);
    }
  }, []);

  const reset = useCallback(() => {
    setIsPaired(false);
    setPairedDevice(null);
  }, []);

  return {
    isPaired,
    pairedDevice,
    pairingCode,
    startScanning,
    reset,
  };
}
