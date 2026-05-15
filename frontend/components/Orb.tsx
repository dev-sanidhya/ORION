"use client";

import { AnimatePresence, motion } from "framer-motion";
import { orionSocket } from "@/lib/socket";
import { AssistantState, useOrionStore } from "@/lib/store";

const STATE_LABELS: Record<AssistantState, string> = {
  idle: "Standby",
  listening: "Listening",
  thinking: "Processing",
  speaking: "Speaking",
};

const STATE_COLORS: Record<AssistantState, string> = {
  idle: "#79E7FF",
  listening: "#52FFC8",
  thinking: "#FFB55F",
  speaking: "#62A0FF",
};

export default function Orb() {
  const state = useOrionStore((s) => s.state);
  const connected = useOrionStore((s) => s.connected);
  const color = STATE_COLORS[state];

  const handleClick = () => {
    if (state === "idle") orionSocket.trigger();
  };

  const active = state !== "idle";

  return (
    <div className="orion-orb-scene flex flex-col items-center gap-7 select-none">
      <div className="relative flex items-center justify-center" style={{ width: 320, height: 320 }}>
        {/* Soft halo - breathes via transform/opacity only (no animated blur). */}
        <div
          className="absolute rounded-full orion-breathe"
          style={{
            width: 290,
            height: 290,
            background: `radial-gradient(circle, ${color}14, transparent 66%)`,
          }}
        />

        {/* Two counter-rotating rings - pure CSS, GPU composited. */}
        <div
          className="absolute rounded-full border orion-spin-slow"
          style={{ width: 280, height: 280, borderColor: `${color}26` }}
        />
        <div
          className="absolute rounded-full border orion-spin-rev"
          style={{ width: 236, height: 236, borderColor: `${color}1c` }}
        />

        <AnimatePresence>
          {state === "thinking" && (
            <motion.div
              key="thinking-ring"
              className="absolute rounded-full border"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1.04, rotate: 360 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{
                opacity: { duration: 0.24 },
                scale: { duration: 0.5 },
                rotate: { duration: 4.4, ease: "linear", repeat: Infinity },
              }}
              style={{
                width: 300,
                height: 300,
                borderColor: `${color}52`,
                borderTopColor: color,
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {state === "listening" &&
            [0, 1, 2].map((index) => (
              <motion.div
                key={`listen-${index}`}
                className="absolute rounded-full border"
                style={{ borderColor: `${color}70` }}
                initial={{ width: 160, height: 160, opacity: 0.7 }}
                animate={{ width: 310, height: 310, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.1, delay: index * 0.45, repeat: Infinity, ease: "easeOut" }}
              />
            ))}
        </AnimatePresence>

        <AnimatePresence>
          {state === "speaking" &&
            [0, 1].map((index) => (
              <motion.div
                key={`speak-${index}`}
                className="absolute rounded-full border"
                style={{ borderColor: `${color}58` }}
                initial={{ width: 156, height: 156, opacity: 0.55 }}
                animate={{
                  width: [156, 250, 156],
                  height: [156, 250, 156],
                  opacity: [0.55, 0.12, 0.55],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.55, delay: index * 0.3, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
        </AnimatePresence>

        <motion.button
          onClick={handleClick}
          className="relative z-10 flex items-center justify-center rounded-full focus:outline-none"
          style={{
            width: 176,
            height: 176,
            border: `1px solid ${color}55`,
            background: `
              radial-gradient(circle at 35% 30%, rgba(255,255,255,0.2), transparent 22%),
              radial-gradient(circle at center, ${color}22, rgba(9,18,40,0.9) 70%)
            `,
            boxShadow: `0 0 40px ${color}20, inset 0 0 50px ${color}12`,
          }}
          whileHover={state === "idle" ? { scale: 1.03 } : {}}
          whileTap={state === "idle" ? { scale: 0.985 } : {}}
        >
          <div
            className="absolute rounded-full border orion-spin-slow"
            style={{ width: 130, height: 130, borderColor: `${color}44` }}
          />
          <div
            className="absolute rounded-full border orion-spin-rev"
            style={{ width: 92, height: 92, borderColor: `${color}55` }}
          />
          <svg width="98" height="98" viewBox="0 0 98 98" fill="none" aria-hidden="true">
            <circle cx="49" cy="49" r="38" stroke={`${color}55`} strokeWidth="1" />
            <circle cx="49" cy="49" r="23" stroke={color} strokeWidth="1.25" strokeDasharray="4 5" />
            <circle cx="49" cy="49" r="10" fill={`${color}44`} stroke={color} strokeWidth="1.2" />
            <circle cx="49" cy="49" r="4" fill={color} />
            {[0, 72, 144, 216, 288].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const x1 = 49 + 14 * Math.cos(rad);
              const y1 = 49 + 14 * Math.sin(rad);
              const x2 = 49 + 31 * Math.cos(rad);
              const y2 = 49 + 31 * Math.sin(rad);
              return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={`${color}88`} strokeWidth="1" />;
            })}
          </svg>
        </motion.button>

        <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.03] via-transparent to-transparent" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <motion.div
          key={state}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs uppercase tracking-[0.42em]"
          style={{ color }}
        >
          {STATE_LABELS[state]}
        </motion.div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: connected ? "#52FFC8" : "#FF6B7B",
              boxShadow: connected ? "0 0 10px #52FFC8" : "0 0 10px #FF6B7B",
            }}
          />
          <span className="text-[10px] uppercase tracking-[0.34em] text-slate-400">
            {connected ? "Connected" : "Offline"}
          </span>
        </div>
      </div>

      {state === "idle" && (
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
          Double clap or click to activate
        </p>
      )}
    </div>
  );
}
