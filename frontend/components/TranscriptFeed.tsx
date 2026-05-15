"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOrionStore } from "@/lib/store";
import SurfacePanel from "@/components/SurfacePanel";

const STATE_ACCENT: Record<string, string> = {
  listening: "#52FFC8",
  thinking: "#FFB55F",
  speaking: "#62A0FF",
};

export default function TranscriptFeed() {
  const transcript = useOrionStore((s) => s.transcript);
  const state = useOrionStore((s) => s.state);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  return (
    <SurfacePanel className="flex h-full min-h-0 flex-col overflow-hidden px-5 py-5 sm:px-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.38em] text-cyan-100/75">Transcript</div>
          <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">Conversation stream</div>
        </div>
        {state !== "idle" && (
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-[10px] uppercase tracking-[0.34em]"
            style={{ color: STATE_ACCENT[state] }}
          >
            {state}
          </motion.span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-5 pr-1">
        {transcript.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Awaiting input</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {transcript.map((entry) => {
            const isUser = entry.role === "user";
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: isUser ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.24 }}
                className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
              >
                <span className="text-[10px] uppercase tracking-[0.34em] text-slate-500">
                  {isUser ? "You" : "Orion"}
                </span>
                <div
                  className="max-w-[85%] rounded-[24px] px-4 py-3 text-sm leading-7"
                  style={{
                    background: isUser ? "rgba(121, 231, 255, 0.09)" : "rgba(98, 160, 255, 0.08)",
                    border: `1px solid ${isUser ? "rgba(121, 231, 255, 0.14)" : "rgba(98, 160, 255, 0.14)"}`,
                    color: isUser ? "#d6edf7" : "#eef6ff",
                  }}
                >
                  {entry.content}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {state === "thinking" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start">
            <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3">
              {[0, 1, 2].map((index) => (
                <motion.div
                  key={index}
                  className="h-1.5 w-1.5 rounded-full bg-cyan-200"
                  animate={{ opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 0.9, delay: index * 0.15, repeat: Infinity }}
                />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </SurfacePanel>
  );
}
