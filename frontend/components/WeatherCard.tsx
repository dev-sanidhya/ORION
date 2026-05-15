"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useOrionStore } from "@/lib/store";

const CONDITION_ICONS: Record<string, string> = {
  "Clear sky": "◎", "Mainly clear": "◎", "Partly cloudy": "◑",
  "Overcast": "●", "Fog": "≋", "Light drizzle": "⋮", "Drizzle": "⋮",
  "Heavy drizzle": "⋮", "Light rain": "⌇", "Rain": "⌇", "Heavy rain": "⌇",
  "Light snow": "✦", "Snow": "✦", "Thunderstorm": "⚡",
};

export default function WeatherCard() {
  const weather = useOrionStore((s) => s.weather);
  const activeWidget = useOrionStore((s) => s.activeWidget);
  const expanded = activeWidget === "weather";

  if (!weather) {
    return (
      <div className="glow-border rounded-sm p-4 bg-orion-surface border border-orion-border flex items-center justify-center h-24">
        <span className="text-xs text-orion-dim tracking-widest">LOADING WEATHER...</span>
      </div>
    );
  }

  const icon = CONDITION_ICONS[weather.condition] ?? "◌";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glow-border rounded-sm bg-orion-surface border flex flex-col gap-3 overflow-hidden"
      style={{
        borderColor: expanded ? "#00D4FF66" : "var(--orion-border, #1a3040)",
        boxShadow: expanded ? "0 0 24px #00D4FF22, inset 0 0 24px #00D4FF08" : undefined,
        padding: expanded ? "20px" : "16px",
      }}
      transition={{ layout: { duration: 0.35, ease: "easeInOut" } }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <motion.span layout className="text-xs text-orion-cyan tracking-widest uppercase">
          {expanded ? "WEATHER — LIVE" : "Weather"}
        </motion.span>
        <span className="text-xs text-orion-dim">{weather.city}</span>
      </div>

      {/* Main temp row */}
      <div className="flex items-center gap-3">
        <motion.span
          layout
          className="text-orion-cyan"
          animate={{ fontSize: expanded ? "3rem" : "1.875rem" }}
          transition={{ duration: 0.3 }}
          style={{ textShadow: "0 0 12px #00D4FF" }}
        >
          {icon}
        </motion.span>
        <div>
          <motion.div
            layout
            className="font-mono text-white"
            animate={{ fontSize: expanded ? "2.5rem" : "1.5rem" }}
            transition={{ duration: 0.3 }}
          >
            {weather.temperature}°C
          </motion.div>
          <div className="text-xs text-orion-dim">Feels {weather.feels_like}°</div>
        </div>
      </div>

      <div className="text-xs text-orion-text">{weather.condition}</div>

      {/* Compact stats - always visible */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-orion-border">
        <Stat label="HIGH" value={`${weather.temp_max}°`} />
        <Stat label="LOW" value={`${weather.temp_min}°`} />
        <Stat label="WIND" value={`${weather.wind_kmh}k`} />
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-orion-border">
              <Stat label="HUMIDITY" value={`${weather.humidity}%`} />
              <Stat label="FEELS LIKE" value={`${weather.feels_like}°C`} />
            </div>
            <div className="mt-3 pt-2 border-t border-orion-border">
              <p className="text-xs text-orion-dim tracking-wider">{weather.summary}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
