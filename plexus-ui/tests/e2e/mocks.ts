declare global {
  interface Window {
    __TAURI_INTERNALS__: any;
    __TAURI_IPC__: (message: any) => Promise<any>;
  }
}

export const mockTauriIPC = async (page: any) => {
  await page.addInitScript(() => {
    const mockHandler = async (cmd: string, args: any) => {
      console.log("IPC Call:", cmd, args);

      switch (cmd) {
        case "check_hardware":
          return {
            cpu_model: "M3 Pro mocked",
            total_memory_gb: 32,
            used_memory_gb: 8,
            cpu_cores: 12,
          };
        case "get_node_status":
          return {
            peer_id: "mock_peer_id_123",
            connected_peers: 5,
          };
        default:
          return {};
      }
    };

    window.__TAURI_INTERNALS__ = {
      invoke: mockHandler,
    };

    // Some older versions or fallback might check IPC
    window.__TAURI_IPC__ = async (message: any) =>
      mockHandler(message.cmd, message);
  });
};
