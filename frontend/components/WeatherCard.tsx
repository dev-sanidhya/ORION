"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useOrionStore } from "@/lib/store";
import SurfacePanel from "@/components/SurfacePanel";

const CONDITION_ICONS: Record<string, string> = {
  "Clear sky": "SUN",
  "Mainly clear": "CLEAR",
  "Partly cloudy": "CLOUD",
  Overcast: "OVER",
  Fog: "FOG",
  "Light drizzle": "DRIZZLE",
  Drizzle: "DRIZZLE",
  "Heavy drizzle": "HEAVY",
  "Light rain": "RAIN",
  Rain: "RAIN",
  "Heavy rain": "STORM",
  "Light snow": "SNOW",
  Snow: "SNOW",
  Thunderstorm: "THUNDER",
};

export default function WeatherCard() {
  const weather = useOrionStore((s) => s.weather);
  const activeWidget = useOrionStore((s) => s.activeWidget);
  const expanded = activeWidget === "weather";

  if (!weather) {
    return (
      <SurfacePanel className="flex h-40 items-center justify-center px-5 py-5 sm:px-6">
        <span className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Loading weather</span>
      </SurfacePanel>
    );
  }

  const icon = CONDITION_ICONS[weather.condition] ?? "SKY";

  return (
    <motion.div layout transition={{ layout: { duration: 0.35, ease: "easeInOut" } }}>
      <SurfacePanel
        className="relative overflow-hidden px-5 py-5 sm:px-6"
        strong={expanded}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-sky-400/10 blur-2xl" />
        </div>

        <div className="relative flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.38em] text-cyan-100/75">
                {expanded ? "Weather live" : "Weather"}
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">{weather.city}</div>
            </div>
            <span className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-cyan-100">
              {icon}
            </span>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="font-mono text-5xl text-white sm:text-6xl">{weather.temperature}C</div>
              <div className="mt-2 text-sm uppercase tracking-[0.2em] text-slate-300">{weather.condition}</div>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-white/[0.035] px-4 py-3 text-right">
              <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Feels like</div>
              <div className="mt-1 font-mono text-lg text-slate-100">{weather.feels_like}C</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
            <Stat label="High" value={`${weather.temp_max}C`} />
            <Stat label="Low" value={`${weather.temp_min}C`} />
            <Stat label="Wind" value={`${weather.wind_kmh} km/h`} />
          </div>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="expanded"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28 }}
                className="overflow-hidden"
              >
                <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
                  <Stat label="Humidity" value={`${weather.humidity}%`} />
                  <Stat label="Summary" value={weather.summary || "Stable"} wide />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SurfacePanel>
    </motion.div>
  );
}

function Stat({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-[22px] border border-white/8 bg-white/[0.035] px-4 py-3 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm leading-6 text-slate-100">{value}</div>
    </div>
  );
}
