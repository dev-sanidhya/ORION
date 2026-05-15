import { create } from "zustand";

export type AssistantState = "idle" | "listening" | "thinking" | "speaking";

export interface TranscriptEntry {
  role: "user" | "orion";
  content: string;
  id: string;
}

export interface WeatherData {
  city: string;
  country: string;
  temperature: number;
  feels_like: number;
  condition: string;
  humidity: number;
  wind_kmh: number;
  temp_max: number;
  temp_min: number;
  summary: string;
}

export interface CalendarEvent {
  title: string;
  start_iso: string;
  location?: string;
}

export interface MemoryResult {
  role: string;
  content: string;
  timestamp: string;
}

export interface Toast {
  id: string;
  text: string;
}

interface OrionStore {
  state: AssistantState;
  transcript: TranscriptEntry[];
  weather: WeatherData | null;
  location: { city: string; country: string } | null;
  connected: boolean;
  amplitude: number;
  clapThreshold: number;
  activeWidget: string | null;
  widgetData: Record<string, unknown>;
  calendar: CalendarEvent[];
  activeProject: string;
  availableProjects: string[];
  toasts: Toast[];
  memoryQuery: string;
  memoryResults: MemoryResult[];

  setState: (s: AssistantState) => void;
  addTranscript: (role: "user" | "orion", content: string) => void;
  setWeather: (data: WeatherData) => void;
  setLocation: (loc: { city: string; country: string }) => void;
  setConnected: (v: boolean) => void;
  setAmplitude: (v: number) => void;
  setClapThreshold: (v: number) => void;
  setActiveWidget: (widget: string | null, data?: Record<string, unknown>) => void;
  setCalendar: (events: CalendarEvent[]) => void;
  setActiveProject: (name: string, available?: string[]) => void;
  pushToast: (text: string) => void;
  dismissToast: (id: string) => void;
  setMemoryResults: (query: string, results: MemoryResult[]) => void;
}

export const useOrionStore = create<OrionStore>((set) => ({
  state: "idle",
  transcript: [],
  weather: null,
  location: null,
  connected: false,
  amplitude: 0,
  clapThreshold: 3500,
  activeWidget: null,
  widgetData: {},
  calendar: [],
  activeProject: "ORION",
  availableProjects: ["ORION"],
  toasts: [],
  memoryQuery: "",
  memoryResults: [],

  setState: (s) => set({ state: s }),

  addTranscript: (role, content) =>
    set((prev) => ({
      transcript: [
        ...prev.transcript.slice(-49),
        { role, content, id: `${Date.now()}-${Math.random()}` },
      ],
    })),

  setWeather: (data) => set({ weather: data }),
  setLocation: (loc) => set({ location: loc }),
  setConnected: (v) => set({ connected: v }),
  setAmplitude: (v) => set({ amplitude: v }),
  setClapThreshold: (v) => set({ clapThreshold: v }),
  setActiveWidget: (widget, data = {}) => set({ activeWidget: widget, widgetData: data }),
  setCalendar: (events) => set({ calendar: events }),
  setActiveProject: (name, available) =>
    set((prev) => ({
      activeProject: name,
      availableProjects: available ?? prev.availableProjects,
    })),
  pushToast: (text) =>
    set((prev) => ({
      toasts: [...prev.toasts, { id: `${Date.now()}-${Math.random()}`, text }].slice(-5),
    })),
  dismissToast: (id) =>
    set((prev) => ({ toasts: prev.toasts.filter((t) => t.id !== id) })),
  setMemoryResults: (query, results) => set({ memoryQuery: query, memoryResults: results }),
}));
