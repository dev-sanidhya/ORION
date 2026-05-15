"use client";

import { motion } from "framer-motion";
import { AssistantState, useOrionStore } from "@/lib/store";

const BAR_COUNT = 28;

const STATE_COLOR: Record<AssistantState, string> = {
  idle: "#79E7FF44",
  listening: "#52FFC8",
  thinking: "#FFB55F",
  speaking: "#62A0FF",
};

export default function Waveform() {
  const state = useOrionStore((s) => s.state);
  const amplitude = useOrionStore((s) => s.amplitude);
  const color = STATE_COLOR[state];
  const isIdle = state === "idle";
  const normalized = Math.min(amplitude / 10000, 1);

  return (
    <div
      className={"flex items-end justify-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-5 py-4 " + (isIdle ? "orion-breathe" : "")}
    >
      {Array.from({ length: BAR_COUNT }).map((_, index) => {
        const center = (BAR_COUNT - 1) / 2;
        const distance = Math.abs(index - center) / center;

        let height = 10;
        if (state === "listening" || state === "speaking") {
          const base = 12 + normalized * 46 * (1 - distance * 0.55);
          const wave = (Math.sin(index * 0.7 + normalized * 8) + 1) * 5;
          height = Math.max(10, base + wave);
        } else if (state === "thinking") {
          height = 16 + (1 - distance) * 20;
        }

        // Render plain divs while idle - no framer-motion loop running 28x.
        if (isIdle) {
          return (
            <div
              key={index}
              className="w-1.5 rounded-full"
              style={{
                height,
                background: `linear-gradient(180deg, ${color}, rgba(255,255,255,0.05))`,
              }}
            />
          );
        }

        return (
          <motion.div
            key={index}
            className="w-1.5 rounded-full"
            style={{
              background: `linear-gradient(180deg, ${color}, rgba(255,255,255,0.05))`,
              boxShadow: `0 0 14px ${color}`,
            }}
            animate={{ height }}
            transition={{
              duration: state === "thinking" ? 0.7 : 0.12,
              ease: "easeOut",
              delay: state === "thinking" ? index * 0.015 : 0,
              repeat: state === "thinking" ? Infinity : 0,
              repeatType: "mirror",
            }}
          />
        );
      })}
    </div>
  );
}
