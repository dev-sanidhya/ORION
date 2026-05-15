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

interface OrionStore {
  state: AssistantState;
  transcript: TranscriptEntry[];
  weather: WeatherData | null;
  location: { city: string; country: string } | null;
  connected: boolean;
  amplitude: number;
  clapThreshold: number;

  setState: (s: AssistantState) => void;
  addTranscript: (role: "user" | "orion", content: string) => void;
  setWeather: (data: WeatherData) => void;
  setLocation: (loc: { city: string; country: string }) => void;
  setConnected: (v: boolean) => void;
  setAmplitude: (v: number) => void;
  setClapThreshold: (v: number) => void;
}

export const useOrionStore = create<OrionStore>((set) => ({
  state: "idle",
  transcript: [],
  weather: null,
  location: null,
  connected: false,
  amplitude: 0,
  clapThreshold: 3500,

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
}));
