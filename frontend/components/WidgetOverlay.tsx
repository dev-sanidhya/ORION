"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useOrionStore, WeatherData } from "@/lib/store";

export default function WidgetOverlay() {
  const activeWidget = useOrionStore((s) => s.activeWidget);
  const widgetData = useOrionStore((s) => s.widgetData);
  const weather = useOrionStore((s) => s.weather);
  const setActiveWidget = useOrionStore((s) => s.setActiveWidget);

  return (
    <AnimatePresence>
      {activeWidget && (
        <motion.div
          key={activeWidget}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0, 6, 18, 0.82)", backdropFilter: "blur(10px)" }}
          onClick={() => setActiveWidget(null)}
        >
          <motion.div
            initial={{ scale: 0.88, y: 32, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="w-full max-w-xl mx-10"
            onClick={(e) => e.stopPropagation()}
          >
            {activeWidget === "weather" && weather && (
              <WeatherOverlay weather={weather} />
            )}
            {activeWidget === "git" && (
              <GitOverlay commits={(widgetData.commits as string[]) ?? []} />
            )}
            {activeWidget === "tweet" && (
              <TweetOverlay text={(widgetData.text as string) ?? ""} onClose={() => setActiveWidget(null)} />
            )}
            {activeWidget === "news" && (
              <NewsOverlayHint onClose={() => setActiveWidget(null)} />
            )}
          </motion.div>

          <div
            className="absolute bottom-8 text-xs text-orion-dim tracking-widest"
            style={{ opacity: 0.5 }}
          >
            CLICK ANYWHERE TO DISMISS
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---- Weather ----------------------------------------------------------------

const CONDITION_ICONS: Record<string, string> = {
  "Clear sky": "◎", "Mainly clear": "◎", "Partly cloudy": "◑",
  "Overcast": "●", "Fog": "≋", "Light drizzle": "⋮", "Drizzle": "⋮",
  "Heavy drizzle": "⋮", "Light rain": "⌇", "Rain": "⌇", "Heavy rain": "⌇",
  "Light snow": "✦", "Snow": "✦", "Thunderstorm": "⚡",
};

function WeatherOverlay({ weather }: { weather: WeatherData }) {
  const icon = CONDITION_ICONS[weather.condition] ?? "◌";
  return (
    <div
      className="rounded-sm flex flex-col gap-6 p-8"
      style={{
        background: "rgba(0, 16, 40, 0.9)",
        border: "1px solid #00D4FF44",
        boxShadow: "0 0 60px #00D4FF18, inset 0 0 40px #00D4FF06",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-orion-cyan tracking-[0.4em]">ATMOSPHERIC CONDITIONS</span>
        <span className="text-xs text-orion-dim">{weather.city}</span>
      </div>

      <div className="flex items-center gap-6">
        <span style={{ fontSize: "5rem", color: "#00D4FF", textShadow: "0 0 30px #00D4FF" }}>
          {icon}
        </span>
        <div>
          <div className="font-mono text-white" style={{ fontSize: "4rem", textShadow: "0 0 20px #ffffff44" }}>
            {weather.temperature}°C
          </div>
          <div className="text-orion-dim text-sm tracking-widest">{weather.condition}</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 pt-4 border-t border-orion-border">
        {[
          ["FEELS LIKE", `${weather.feels_like}°C`],
          ["HUMIDITY", `${weather.humidity}%`],
          ["WIND", `${weather.wind_kmh} km/h`],
          ["HIGH / LOW", `${weather.temp_max}° / ${weather.temp_min}°`],
        ].map(([label, val]) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <span className="text-xs text-orion-dim tracking-widest">{label}</span>
            <span className="text-sm font-mono text-orion-text">{val}</span>
          </div>
        ))}
      </div>

      {weather.summary && (
        <p className="text-sm text-orion-dim leading-relaxed border-t border-orion-border pt-4">
          {weather.summary}
        </p>
      )}
    </div>
  );
}

// ---- Git --------------------------------------------------------------------

function GitOverlay({ commits }: { commits: string[] }) {
  return (
    <div
      className="rounded-sm flex flex-col gap-4 p-8"
      style={{
        background: "rgba(0, 16, 8, 0.92)",
        border: "1px solid #00FF8844",
        boxShadow: "0 0 60px #00FF8812, inset 0 0 40px #00FF8806",
      }}
    >
      <div className="flex items-center justify-between border-b border-orion-border pb-3">
        <span className="text-xs tracking-[0.4em]" style={{ color: "#00FF88" }}>COMMIT HISTORY</span>
        <span className="text-xs text-orion-dim">ORION</span>
      </div>

      <div className="flex flex-col gap-3">
        {commits.length === 0 ? (
          <span className="text-sm text-orion-dim">No recent commits found.</span>
        ) : (
          commits.map((line, i) => {
            const [hash, ...rest] = line.split(" ");
            const msg = rest.join(" ");
            const timeMatch = msg.match(/\((.+)\)$/);
            const clean = msg.replace(/\(.*\)$/, "").trim();
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start gap-3"
              >
                <span className="font-mono text-sm shrink-0" style={{ color: "#00FF88" }}>{hash}</span>
                <span className="text-sm text-orion-text font-mono flex-1 leading-snug">{clean}</span>
                {timeMatch && (
                  <span className="text-xs text-orion-dim shrink-0 mt-0.5">{timeMatch[1]}</span>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---- Tweet ------------------------------------------------------------------

function TweetOverlay({ text, onClose }: { text: string; onClose: () => void }) {
  const remaining = 280 - text.length;
  const copy = () => {
    navigator.clipboard.writeText(text).then(onClose);
  };

  return (
    <div
      className="rounded-sm flex flex-col gap-5 p-8"
      style={{
        background: "rgba(0, 10, 24, 0.92)",
        border: "1px solid rgba(29,161,242,0.4)",
        boxShadow: "0 0 60px rgba(29,161,242,0.12), inset 0 0 40px rgba(29,161,242,0.04)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span style={{ color: "#1DA1F2", fontSize: "20px" }}>𝕏</span>
          <span className="text-sm tracking-[0.3em]" style={{ color: "#1DA1F2" }}>TWEET DRAFT</span>
        </div>
        <span
          className="text-sm font-mono"
          style={{ color: remaining < 20 ? "#FF4444" : remaining < 60 ? "#FF9900" : "#555" }}
        >
          {remaining}
        </span>
      </div>

      <p className="text-lg leading-relaxed" style={{ color: "#C8E8F8" }}>{text}</p>

      <div className="flex gap-3 pt-2 border-t border-orion-border">
        <motion.button
          onClick={copy}
          whileTap={{ scale: 0.96 }}
          className="px-5 py-2 rounded-sm text-sm tracking-widest"
          style={{
            border: "1px solid rgba(29,161,242,0.5)",
            color: "#1DA1F2",
            background: "rgba(29,161,242,0.08)",
          }}
        >
          COPY & DISMISS
        </motion.button>
        <span className="text-xs text-orion-dim self-center">Paste into X to post</span>
      </div>
    </div>
  );
}

// ---- News hint --------------------------------------------------------------

function NewsOverlayHint({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="rounded-sm flex flex-col gap-4 p-8 text-center"
      style={{
        background: "rgba(0, 12, 28, 0.9)",
        border: "1px solid #00D4FF33",
      }}
    >
      <span className="text-xs text-orion-cyan tracking-[0.4em]">INTEL FEED</span>
      <p className="text-sm text-orion-dim">See the news panel on the right for latest headlines.</p>
      <button
        onClick={onClose}
        className="text-xs text-orion-dim tracking-widest hover:text-orion-cyan transition-colors"
      >
        DISMISS
      </button>
    </div>
  );
}
