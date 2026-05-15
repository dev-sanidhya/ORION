import { useOrionStore } from "./store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

class OrionSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log("[ORION] WebSocket connected");
      useOrionStore.getState().setConnected(true);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onclose = () => {
      console.log("[ORION] WebSocket disconnected, retrying in 3s...");
      useOrionStore.getState().setConnected(false);
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (err) => {
      console.error("[ORION] WebSocket error", err);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const store = useOrionStore.getState();

        switch (msg.type) {
          case "state":
            store.setState(msg.state);
            break;
          case "transcript":
            store.addTranscript(msg.role, msg.content);
            break;
          case "weather":
            store.setWeather(msg.data);
            break;
          case "location":
            store.setLocation(msg.data);
            break;
        }
      } catch (e) {
        console.error("[ORION] Bad WS message", e);
      }
    };
  }

  trigger() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "trigger" }));
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

export const orionSocket = new OrionSocket();
