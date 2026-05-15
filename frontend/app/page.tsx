"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { orionSocket } from "@/lib/socket";
import { useOrionStore } from "@/lib/store";
import Orb from "@/components/Orb";
import ClockWidget from "@/components/ClockWidget";
import WeatherCard from "@/components/WeatherCard";
import TranscriptFeed from "@/components/TranscriptFeed";
import NewsStrip from "@/components/NewsStrip";
import Waveform from "@/components/Waveform";
import GitPanel from "@/components/GitPanel";
import TweetPreview from "@/components/TweetPreview";
import WidgetOverlay from "@/components/WidgetOverlay";
import SurfacePanel from "@/components/SurfacePanel";

export default function Dashboard() {
  const connected = useOrionStore((s) => s.connected);
  const activeWidget = useOrionStore((s) => s.activeWidget);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    orionSocket.connect();

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") e.preventDefault();
    };

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      orionSocket.disconnect();
    };
  }, []);

  return (
    <main className="orion-shell h-screen overflow-hidden px-4 py-4 sm:px-6 sm:py-6 xl:px-8">
      <WidgetOverlay />

      {/* Single low-cost gradient background. The previous stack of three
          blur-3xl orbs forced fullscreen GPU compositing for no real gain. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 22% 18%, rgba(34,211,238,0.10), transparent 45%), radial-gradient(circle at 80% 24%, rgba(139,92,246,0.10), transparent 50%), radial-gradient(circle at 50% 92%, rgba(14,165,233,0.10), transparent 55%)",
        }}
      />

      <div className="relative z-10 flex h-full flex-col gap-4">
        <header className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
          <SurfacePanel className="flex flex-col gap-4 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.45em] text-cyan-100/80">
                    Orion
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
                    Ambient Intelligence Interface
                  </span>
                </div>
                <div className="max-w-2xl">
                  <h1 className="text-2xl font-medium tracking-[0.16em] text-slate-50 sm:text-3xl">
                    A smoother command surface for the same motive.
                  </h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {["voice", "memory", "weather", "news", "git"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-slate-400">
              <span className="text-cyan-100/85">Personal Intelligence System</span>
              <span className="h-1 w-1 rounded-full bg-slate-600" />
              <span>Voice first</span>
              <span className="h-1 w-1 rounded-full bg-slate-600" />
              <span>Live context</span>
              <span className="h-1 w-1 rounded-full bg-slate-600" />
              <span>Abstract motion</span>
            </div>
          </SurfacePanel>

          <SurfacePanel className="flex items-center justify-between gap-5 px-5 py-4 sm:min-w-[340px] sm:px-6">
            <ClockWidget />
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[11px] uppercase tracking-[0.35em] text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-300/15"
            >
              {showSettings ? "Hide Config" : "System Config"}
            </button>
          </SurfacePanel>
        </header>

        <AnimatePresence initial={false}>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <SurfacePanel className="px-5 py-5 sm:px-6">
                <SettingsPanel />
              </SurfacePanel>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <div className="flex min-h-0 flex-col gap-4">
            <WeatherCard />
            <AnimatePresence mode="wait">
              {activeWidget === "git" ? <GitPanel key="git" /> : <ActiveProjectTile key="project" />}
            </AnimatePresence>
          </div>

          <SurfacePanel strong className="relative min-h-[420px] overflow-hidden px-5 py-5 sm:px-8 sm:py-7">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-[8%] top-[10%] h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
              <div className="absolute bottom-[14%] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full border border-cyan-300/10" />
              <div className="absolute bottom-[12%] left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full border border-white/5" />
            </div>

            <div className="relative flex h-full flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.4em] text-cyan-100/75">Central Core</div>
                  <div className="mt-1 text-sm uppercase tracking-[0.32em] text-slate-400">
                    Abstract listening scene
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.34em] text-slate-300">
                  Smooth mode
                </div>
              </div>

              <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
                <Orb />
                <Waveform />
                <AnimatePresence mode="wait">
                  {activeWidget === "tweet" ? <TweetPreview key="tweet" /> : <ShortcutsHint key="hints" />}
                </AnimatePresence>
              </div>
            </div>
          </SurfacePanel>

          <div className="grid min-h-0 gap-4 lg:grid-rows-[minmax(0,1fr)_minmax(250px,0.72fr)]">
            <TranscriptFeed />
            <NewsStrip highlight={activeWidget === "news"} />
          </div>
        </section>

        <footer className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
          <SurfacePanel className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: connected ? "#52FFC8" : "#FF6B7B",
                  boxShadow: connected ? "0 0 14px #52FFC8" : "0 0 14px #FF6B7B",
                }}
              />
              <span className="text-[11px] uppercase tracking-[0.34em] text-slate-300">
                {connected ? "Backend online" : "Backend offline. Start python main.py"}
              </span>
            </div>
            <span className="text-[11px] uppercase tracking-[0.34em] text-slate-500">
              Double clap. Hold space. Say wake up. Click orb.
            </span>
          </SurfacePanel>

          <SurfacePanel className="flex items-center justify-center px-5 py-3 sm:px-6">
            <span className="text-[11px] uppercase tracking-[0.4em] text-slate-500">ORION v0.4</span>
          </SurfacePanel>
        </footer>
      </div>
    </main>
  );
}

function ActiveProjectTile() {
  return (
    <SurfacePanel className="flex h-full flex-col gap-5 px-5 py-5 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.38em] text-cyan-100/75">Active Project</div>
          <div className="mt-3 text-2xl font-medium tracking-[0.16em] text-white">ORION</div>
        </div>
        <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-emerald-200">
          All phases active
        </div>
      </div>

      <p className="max-w-sm text-sm leading-7 text-slate-300">
        Persistent voice system with memory, environment awareness, live briefings, and contextual overlays.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ["Runtime", "Full"],
          ["Signal", "Realtime"],
          ["Mode", "Ambient"],
          ["Surface", "Abstract HUD"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{label}</div>
            <div className="mt-1 text-sm uppercase tracking-[0.2em] text-slate-100">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-white/10 pt-4 text-xs uppercase tracking-[0.3em] text-slate-500">
        github.com/dev-sanidhya/ORION
      </div>
    </SurfacePanel>
  );
}

function ShortcutsHint() {
  const hints = ["Double clap", "Hold space", "Say wake up", "Click orb"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {hints.map((hint) => (
        <span
          key={hint}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-slate-400"
        >
          {hint}
        </span>
      ))}
    </motion.div>
  );
}

function SettingsPanel() {
  const [city, setCity] = useState("");
  const threshold = useOrionStore((s) => s.clapThreshold);
  const setClapThreshold = useOrionStore((s) => s.setClapThreshold);

  const handleThreshold = (v: number) => {
    setClapThreshold(v);
    orionSocket.setThreshold(v);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.4em] text-cyan-100/75">System Config</div>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
            Keep the same wake flow and backend behavior, but tune sensitivity and environment settings from a cleaner control surface.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="min-w-40 text-[11px] uppercase tracking-[0.34em] text-slate-400">
              Clap sensitivity
            </label>
            <div className="flex min-w-[220px] flex-1 items-center gap-3">
              <span className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Sensitive</span>
              <input
                type="range"
                min={800}
                max={7000}
                step={100}
                value={threshold}
                onChange={(e) => handleThreshold(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Less</span>
              <span className="w-14 text-right font-mono text-sm text-white">{threshold}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-400">Location</div>
          <div className="mt-3 flex gap-2">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Aligarh"
              className="flex-1 rounded-full border border-white/10 bg-slate-950/35 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/35"
            />
            <button
              onClick={() => city && alert(`Set ORION_CITY=${city} in backend/.env and restart.`)}
              className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-300/15"
            >
              Apply
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-400">Runtime Notes</div>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            <div>Model: claude-haiku-4-5</div>
            <div>Voice dismissal: say &quot;sleep&quot;</div>
          </div>
        </div>
      </div>
    </div>
  );
}
