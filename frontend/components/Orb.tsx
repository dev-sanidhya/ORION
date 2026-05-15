"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useOrionStore, AssistantState } from "@/lib/store";
import { orionSocket } from "@/lib/socket";

const STATE_LABELS: Record<AssistantState, string> = {
  idle: "STANDBY",
  listening: "LISTENING",
  thinking: "PROCESSING",
  speaking: "SPEAKING",
};

const STATE_COLORS: Record<AssistantState, string> = {
  idle: "#00D4FF",
  listening: "#00FF88",
  thinking: "#FF9900",
  speaking: "#0088FF",
};

export default function Orb() {
  const state = useOrionStore((s) => s.state);
  const connected = useOrionStore((s) => s.connected);
  const color = STATE_COLORS[state];

  const handleClick = () => {
    if (state === "idle") orionSocket.trigger();
  };

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      {/* Outer rings */}
      <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>

        {/* Outermost rotating ring - only when thinking */}
        <AnimatePresence>
          {state === "thinking" && (
            <motion.div
              key="outer-ring"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{ rotate: { duration: 3, repeat: Infinity, ease: "linear" }, opacity: { duration: 0.3 } }}
              className="absolute rounded-full border"
              style={{
                width: 230, height: 230,
                borderColor: `${color}44`,
                borderTopColor: color,
                borderWidth: 1,
              }}
            />
          )}
        </AnimatePresence>

        {/* Listening rings expanding outward */}
        <AnimatePresence>
          {state === "listening" && (
            <>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={`ring-${i}`}
                  className="absolute rounded-full border"
                  style={{ borderColor: color, borderWidth: 1 }}
                  initial={{ width: 160, height: 160, opacity: 0.7 }}
                  animate={{ width: 230, height: 230, opacity: 0 }}
                  transition={{ duration: 1.8, delay: i * 0.6, repeat: Infinity, ease: "easeOut" }}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Speaking rings */}
        <AnimatePresence>
          {state === "speaking" && (
            <>
              {[0, 1].map((i) => (
                <motion.div
                  key={`speak-${i}`}
                  className="absolute rounded-full border"
                  style={{ borderColor: color, borderWidth: 1 }}
                  initial={{ width: 140, height: 140, opacity: 0.6 }}
                  animate={{ width: [140, 200, 140], height: [140, 200, 140], opacity: [0.6, 0.1, 0.6] }}
                  transition={{ duration: 1.2, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Middle ring */}
        <motion.div
          className="absolute rounded-full border"
          style={{ width: 170, height: 170, borderColor: `${color}33`, borderWidth: 1 }}
          animate={{ rotate: state === "thinking" ? -360 : 0 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />

        {/* Core orb - clickable */}
        <motion.button
          onClick={handleClick}
          className="relative z-10 rounded-full flex items-center justify-center cursor-pointer focus:outline-none"
          style={{
            width: 130,
            height: 130,
            background: `radial-gradient(circle at 35% 35%, ${color}22, ${color}08 60%, transparent 100%)`,
            border: `1px solid ${color}66`,
            boxShadow: `0 0 30px ${color}33, 0 0 60px ${color}18, inset 0 0 20px ${color}11`,
          }}
          whileHover={state === "idle" ? { scale: 1.05 } : {}}
          whileTap={state === "idle" ? { scale: 0.97 } : {}}
          animate={
            state === "idle"
              ? { boxShadow: [`0 0 20px ${color}22, inset 0 0 15px ${color}08`, `0 0 40px ${color}44, inset 0 0 25px ${color}15`, `0 0 20px ${color}22, inset 0 0 15px ${color}08`] }
              : {}
          }
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Inner arc reactor pattern */}
          <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
            <circle cx="35" cy="35" r="32" stroke={`${color}44`} strokeWidth="0.5" />
            <circle cx="35" cy="35" r="22" stroke={`${color}66`} strokeWidth="0.5" />
            <circle cx="35" cy="35" r="10" fill={`${color}22`} stroke={color} strokeWidth="1" />
            <circle cx="35" cy="35" r="5" fill={color} opacity="0.9" />
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const x1 = 35 + 11 * Math.cos(rad);
              const y1 = 35 + 11 * Math.sin(rad);
              const x2 = 35 + 21 * Math.cos(rad);
              const y2 = 35 + 21 * Math.sin(rad);
              return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={`${color}88`} strokeWidth="0.75" />;
            })}
          </svg>
        </motion.button>
      </div>

      {/* Status label */}
      <div className="flex flex-col items-center gap-1">
        <motion.div
          key={state}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs tracking-widest font-mono"
          style={{ color }}
        >
          {STATE_LABELS[state]}
        </motion.div>

        {/* Connection dot */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: connected ? "#00FF88" : "#FF4444", boxShadow: connected ? "0 0 6px #00FF88" : "0 0 6px #FF4444" }}
          />
          <span className="text-xs text-orion-dim tracking-widest">
            {connected ? "CONNECTED" : "OFFLINE"}
          </span>
        </div>
      </div>

      {state === "idle" && (
        <p className="text-xs text-orion-dim tracking-wider">DOUBLE CLAP OR CLICK TO ACTIVATE</p>
      )}
    </div>
  );
}
