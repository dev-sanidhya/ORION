"use client";
import { motion } from "framer-motion";
import { useOrionStore } from "@/lib/store";

const CONDITION_ICONS: Record<string, string> = {
  "Clear sky": "◎",
  "Mainly clear": "◎",
  "Partly cloudy": "◑",
  "Overcast": "●",
  "Fog": "≋",
  "Light drizzle": "⋮",
  "Drizzle": "⋮",
  "Heavy drizzle": "⋮",
  "Light rain": "⌇",
  "Rain": "⌇",
  "Heavy rain": "⌇",
  "Light snow": "✦",
  "Snow": "✦",
  "Thunderstorm": "⚡",
};

export default function WeatherCard() {
  const weather = useOrionStore((s) => s.weather);

  if (!weather) {
    return (
      <div className="glow-border rounded-sm p-4 bg-orion-surface border border-orion-border flex items-center justify-center h-full">
        <span className="text-xs text-orion-dim tracking-widest">LOADING WEATHER...</span>
      </div>
    );
  }

  const icon = CONDITION_ICONS[weather.condition] ?? "◌";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glow-border rounded-sm p-4 bg-orion-surface border border-orion-border flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-orion-cyan tracking-widest uppercase">Weather</span>
        <span className="text-xs text-orion-dim">{weather.city}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-3xl text-orion-cyan" style={{ textShadow: "0 0 12px #00D4FF" }}>
          {icon}
        </span>
        <div>
          <div className="text-2xl font-mono text-white">{weather.temperature}°C</div>
          <div className="text-xs text-orion-dim">Feels {weather.feels_like}°</div>
        </div>
      </div>

      <div className="text-xs text-orion-text">{weather.condition}</div>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-orion-border">
        <Stat label="HIGH" value={`${weather.temp_max}°`} />
        <Stat label="LOW" value={`${weather.temp_min}°`} />
        <Stat label="WIND" value={`${weather.wind_kmh}k`} />
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-orion-dim text-xs tracking-widest">{label}</span>
      <span className="text-orion-text text-sm font-mono">{value}</span>
    </div>
  );
}
