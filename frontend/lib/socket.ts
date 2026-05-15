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
          case "amplitude":
            store.setAmplitude(msg.value);
            break;
          case "widget_focus":
            store.setActiveWidget(msg.widget, msg.data ?? {});
            break;
          case "widget_blur":
            store.setActiveWidget(null);
            break;
          case "calendar":
            store.setCalendar(msg.events ?? []);
            break;
          case "active_project":
            store.setActiveProject(msg.name, msg.available);
            break;
          case "toast":
            store.pushToast(msg.text);
            break;
          case "post_tweet_result":
            store.pushToast(msg.ok ? "Tweet scheduled to Typefully" : `Post failed: ${msg.error ?? "unknown"}`);
            break;
          case "memory_results":
            store.setMemoryResults(msg.query, msg.results ?? []);
            break;
        }
      } catch (e) {
        console.error("[ORION] Bad WS message", e);
      }
    };
  }

  private send(payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  trigger() {
    this.send({ type: "trigger" });
  }

  setThreshold(value: number) {
    this.send({ type: "set_threshold", value });
  }

  postTweet(text: string) {
    this.send({ type: "post_tweet", text });
  }

  setProject(name: string) {
    this.send({ type: "set_project", name });
  }

  searchMemory(query: string) {
    this.send({ type: "search_memory", query });
  }

  refreshCalendar() {
    this.send({ type: "refresh_calendar" });
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

export const orionSocket = new OrionSocket();
