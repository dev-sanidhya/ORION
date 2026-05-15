"use client";
import { useEffect, useState } from "react";
import { orionSocket } from "@/lib/socket";
import { useOrionStore } from "@/lib/store";
import Orb from "@/components/Orb";
import ClockWidget from "@/components/ClockWidget";
import WeatherCard from "@/components/WeatherCard";
import TranscriptFeed from "@/components/TranscriptFeed";
import NewsStrip from "@/components/NewsStrip";
import Waveform from "@/components/Waveform";

export default function Dashboard() {
  const connected = useOrionStore((s) => s.connected);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    orionSocket.connect();

    // Keyboard shortcut: Ctrl+Space to trigger
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        orionSocket.trigger();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      orionSocket.disconnect();
    };
  }, []);

  return (
    <main className="w-screen h-screen flex flex-col p-5 gap-3 overflow-hidden select-none">

      {/* Top bar */}
      <header className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-orion-cyan text-sm tracking-[0.4em] glow-cyan font-mono">ORION</span>
          <span className="text-orion-dim text-xs tracking-widest hidden sm:block">PERSONAL INTELLIGENCE SYSTEM</span>
        </div>

        <div className="flex items-center gap-6">
          <ClockWidget />
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="text-orion-dim hover:text-orion-cyan transition-colors text-xs tracking-widest"
          >
            {showSettings ? "CLOSE" : "CONFIG"}
          </button>
        </div>
      </header>

      {/* Settings panel */}
      {showSettings && (
        <div className="glow-border rounded-sm bg-orion-surface border border-orion-border px-4 py-3 flex-shrink-0">
          <SettingsPanel />
        </div>
      )}

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">

        {/* Left column */}
        <div className="col-span-3 flex flex-col gap-3 min-h-0">
          <WeatherCard />
          <ActiveProjectTile />
        </div>

        {/* Center */}
        <div className="col-span-5 flex flex-col items-center justify-center gap-4">
          <Orb />
          <Waveform />
          <ShortcutsHint />
        </div>

        {/* Right column */}
        <div className="col-span-4 grid grid-rows-2 gap-3 min-h-0">
          <TranscriptFeed />
          <NewsStrip />
        </div>
      </div>

      {/* Bottom bar */}
      <footer className="flex items-center justify-between flex-shrink-0 border-t border-orion-border pt-2">
        <div className="flex items-center gap-3">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: connected ? "#00FF88" : "#FF4444",
              boxShadow: connected ? "0 0 6px #00FF88" : "0 0 6px #FF4444",
            }}
          />
          <span className="text-xs text-orion-dim tracking-widest">
            {connected ? "BACKEND ONLINE" : "BACKEND OFFLINE - IS python main.py RUNNING?"}
          </span>
        </div>
        <span className="text-xs text-orion-dim tracking-widest">ORION v0.4</span>
      </footer>
    </main>
  );
}

function ActiveProjectTile() {
  return (
    <div className="glow-border rounded-sm p-4 bg-orion-surface border border-orion-border flex flex-col gap-2 flex-1">
      <span className="text-xs text-orion-cyan tracking-widest">ACTIVE PROJECT</span>
      <div className="text-sm text-orion-text font-mono">ORION</div>
      <div className="text-xs text-orion-dim">All Phases Active</div>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {["voice", "memory", "weather", "news", "git"].map((tag) => (
          <span
            key={tag}
            className="text-xs px-1.5 py-0.5 rounded-sm"
            style={{
              background: "rgba(0,212,255,0.06)",
              border: "1px solid rgba(0,212,255,0.18)",
              color: "#00D4FF77",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-auto pt-2 border-t border-orion-border">
        <span className="text-xs text-orion-dim">github.com/dev-sanidhya/ORION</span>
      </div>
    </div>
  );
}

function ShortcutsHint() {
  return (
    <div className="flex gap-4 text-xs text-orion-dim tracking-widest">
      <span>DOUBLE CLAP</span>
      <span className="text-orion-border">|</span>
      <span>CTRL+SPACE</span>
      <span className="text-orion-border">|</span>
      <span>CLICK ORB</span>
    </div>
  );
}

function SettingsPanel() {
  const [city, setCity] = useState("");

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <span className="text-xs text-orion-cyan tracking-widest">SYSTEM CONFIG</span>
      <div className="flex items-center gap-2">
        <label className="text-xs text-orion-dim tracking-widest">LOCATION OVERRIDE</label>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. Aligarh"
          className="bg-transparent border border-orion-border rounded-sm px-2 py-1 text-xs text-orion-text focus:border-orion-cyan outline-none w-32"
        />
        <button
          onClick={() => city && alert(`Set ORION_CITY=${city} in backend/.env and restart backend.`)}
          className="text-xs px-2 py-1 rounded-sm border border-orion-border text-orion-dim hover:text-orion-cyan hover:border-orion-cyan transition-colors"
        >
          APPLY
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-orion-dim tracking-widest">BACKEND</span>
        <span className="text-xs text-orion-text">localhost:8000</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-orion-dim tracking-widest">MODEL</span>
        <span className="text-xs text-orion-text">claude-sonnet-4-6</span>
      </div>
    </div>
  );
}
