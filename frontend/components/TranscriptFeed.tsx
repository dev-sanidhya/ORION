"use client";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOrionStore } from "@/lib/store";

export default function TranscriptFeed() {
  const transcript = useOrionStore((s) => s.transcript);
  const state = useOrionStore((s) => s.state);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  return (
    <div className="glow-border rounded-sm bg-orion-surface border border-orion-border flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-orion-border">
        <span className="text-xs text-orion-cyan tracking-widest">TRANSCRIPT</span>
        {state !== "idle" && (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-xs tracking-widest"
            style={{ color: state === "listening" ? "#00FF88" : state === "thinking" ? "#FF9900" : "#0088FF" }}
          >
            {state.toUpperCase()}
          </motion.span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
        {transcript.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-orion-dim text-xs tracking-widest">AWAITING INPUT</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {transcript.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: entry.role === "user" ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex flex-col gap-0.5 ${entry.role === "user" ? "items-end" : "items-start"}`}
            >
              <span className="text-xs tracking-widest" style={{ color: entry.role === "user" ? "#3A5A70" : "#00D4FF" }}>
                {entry.role === "user" ? "YOU" : "ORION"}
              </span>
              <div
                className="text-sm rounded-sm px-3 py-2 max-w-xs"
                style={{
                  background: entry.role === "user" ? "rgba(0,212,255,0.05)" : "rgba(0,102,255,0.07)",
                  border: `1px solid ${entry.role === "user" ? "rgba(0,212,255,0.15)" : "rgba(0,102,255,0.2)"}`,
                  color: entry.role === "user" ? "#A0C4D8" : "#C8E8F8",
                }}
              >
                {entry.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {state === "thinking" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-2"
          >
            <div className="flex gap-1 px-3 py-2 rounded-sm" style={{ border: "1px solid rgba(0,102,255,0.2)", background: "rgba(0,102,255,0.07)" }}>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-orion-cyan"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.9, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
