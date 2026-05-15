"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WeatherData, useOrionStore } from "@/lib/store";
import { orionSocket } from "@/lib/socket";

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
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 sm:px-8"
          style={{
            background:
              "radial-gradient(circle at center, rgba(24,43,94,0.55), rgba(3,7,18,0.96) 60%)",
          }}
          onClick={() => setActiveWidget(null)}
        >

          <motion.div
            initial={{ scale: 0.92, y: 28, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 18, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 240 }}
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            {activeWidget === "weather" && weather && <WeatherOverlay weather={weather} />}
            {activeWidget === "git" && <GitOverlay commits={(widgetData.commits as string[]) ?? []} />}
            {activeWidget === "tweet" && (
              <TweetOverlay
                text={(widgetData.text as string) ?? ""}
                onClose={() => setActiveWidget(null)}
              />
            )}
            {activeWidget === "news" && <NewsOverlayHint onClose={() => setActiveWidget(null)} />}
          </motion.div>

          <div className="absolute bottom-8 text-[11px] uppercase tracking-[0.34em] text-slate-500">
            Click anywhere to dismiss
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OverlayFrame({
  title,
  accent,
  eyebrow,
  children,
}: {
  title: string;
  accent: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-[36px] border px-6 py-6 shadow-[0_40px_120px_rgba(4,8,18,0.7)] sm:px-8 sm:py-8"
      style={{
        background: "linear-gradient(180deg, rgba(14,24,50,0.92), rgba(7,14,30,0.86))",
        borderColor: `${accent}44`,
      }}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.42em]" style={{ color: accent }}>
            {eyebrow}
          </div>
          <div className="mt-2 text-3xl uppercase tracking-[0.16em] text-white sm:text-4xl">{title}</div>
        </div>
        <div
          className="h-12 w-12 rounded-full border"
          style={{
            borderColor: `${accent}55`,
            boxShadow: `0 0 28px ${accent}20, inset 0 0 18px ${accent}18`,
          }}
        />
      </div>
      {children}
    </div>
  );
}

function WeatherOverlay({ weather }: { weather: WeatherData }) {
  return (
    <OverlayFrame title={weather.city} accent="#79E7FF" eyebrow="Atmospheric scene">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-cyan-300/15 bg-cyan-300/[0.05] p-6">
          <div className="font-mono text-7xl text-white sm:text-8xl">{weather.temperature}C</div>
          <div className="mt-3 text-lg uppercase tracking-[0.2em] text-slate-300">{weather.condition}</div>
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">{weather.summary}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {[
            ["Feels like", `${weather.feels_like}C`],
            ["Humidity", `${weather.humidity}%`],
            ["Wind", `${weather.wind_kmh} km/h`],
            ["High / Low", `${weather.temp_max}C / ${weather.temp_min}C`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{label}</div>
              <div className="mt-2 text-xl text-slate-100">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </OverlayFrame>
  );
}

function GitOverlay({ commits }: { commits: string[] }) {
  return (
    <OverlayFrame title="Commit History" accent="#52FFC8" eyebrow="Repository scene">
      <div className="space-y-3">
        {commits.length === 0 ? (
          <span className="text-sm text-slate-400">No recent commits found.</span>
        ) : (
          commits.map((line, index) => {
            const [hash, ...rest] = line.split(" ");
            const message = rest.join(" ");
            const timeMatch = message.match(/\((.+)\)$/);
            const clean = message.replace(/\(.*\)$/, "").trim();

            return (
              <motion.div
                key={`${hash}-${index}`}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex flex-wrap items-start gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4"
              >
                <span className="font-mono text-sm uppercase tracking-[0.18em] text-emerald-200">{hash}</span>
                <span className="flex-1 text-sm leading-7 text-slate-200">{clean}</span>
                {timeMatch && <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{timeMatch[1]}</span>}
              </motion.div>
            );
          })
        )}
      </div>
    </OverlayFrame>
  );
}

function TweetOverlay({ text, onClose }: { text: string; onClose: () => void }) {
  const remaining = 280 - text.length;

  const copy = () => {
    navigator.clipboard.writeText(text).then(onClose);
  };

  const schedule = () => {
    orionSocket.postTweet(text);
    onClose();
  };

  return (
    <OverlayFrame title="Tweet Draft" accent="#62A0FF" eyebrow="Social scene">
      <div className="rounded-[28px] border border-sky-300/15 bg-sky-300/[0.05] p-6">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[11px] uppercase tracking-[0.34em] text-sky-100/85">Ready</span>
          <span
            className="font-mono text-sm"
            style={{ color: remaining < 20 ? "#FF6B7B" : remaining < 60 ? "#FFB55F" : "#8AA4BC" }}
          >
            {remaining}
          </span>
        </div>

        <p className="mt-5 text-xl leading-9 text-slate-100">{text}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
          <button
            onClick={schedule}
            className="rounded-full border border-sky-300/40 bg-sky-300/20 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-sky-100 transition hover:bg-sky-300/30"
          >
            Schedule to Typefully
          </button>
          <button
            onClick={copy}
            className="rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-200 transition hover:bg-white/[0.1]"
          >
            Copy
          </button>
          <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
            Needs TYPEFULLY_API_KEY
          </span>
        </div>
      </div>
    </OverlayFrame>
  );
}

function NewsOverlayHint({ onClose }: { onClose: () => void }) {
  return (
    <OverlayFrame title="Intel Feed" accent="#79E7FF" eyebrow="News scene">
      <div className="flex flex-col items-center gap-5 rounded-[28px] border border-white/10 bg-white/[0.04] px-6 py-8 text-center">
        <p className="max-w-xl text-base leading-8 text-slate-300">
          The live headlines remain pinned on the right rail. This fullscreen scene acts as an abstract focus state instead of duplicating the feed content.
        </p>
        <button
          onClick={onClose}
          className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-cyan-100 transition hover:bg-cyan-300/15"
        >
          Dismiss
        </button>
      </div>
    </OverlayFrame>
  );
}
