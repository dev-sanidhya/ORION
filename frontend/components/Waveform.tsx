"use client";
import { motion } from "framer-motion";
import { useOrionStore, AssistantState } from "@/lib/store";

const BAR_COUNT = 20;

const STATE_COLOR: Record<AssistantState, string> = {
  idle: "#00D4FF33",
  listening: "#00FF88",
  thinking: "#FF9900",
  speaking: "#0088FF",
};

export default function Waveform() {
  const state = useOrionStore((s) => s.state);
  const amplitude = useOrionStore((s) => s.amplitude);
  const color = STATE_COLOR[state];

  // Normalize amplitude to 0-1 (mic peaks around 8000-15000 for normal speech)
  const norm = Math.min(amplitude / 10000, 1);

  return (
    <div className="flex items-center justify-center gap-0.5 h-12">
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const center = BAR_COUNT / 2;
        const distFromCenter = Math.abs(i - center) / center;

        let height: number;
        if (state === "idle") {
          height = 4;
        } else if (state === "listening" || state === "speaking") {
          // Real amplitude drives height, tapered toward edges
          const base = 6 + norm * 34 * (1 - distFromCenter * 0.6);
          // Add per-bar variation based on index to avoid a flat wall
          const variation = Math.sin(i * 0.8 + Date.now() * 0.001) * norm * 8;
          height = Math.max(4, base + variation);
        } else {
          // thinking - slow pulse
          height = 6 + (1 - distFromCenter) * 6;
        }

        return (
          <motion.div
            key={i}
            className="rounded-full w-1"
            style={{ backgroundColor: state === "idle" ? color : `${color}cc` }}
            animate={{ height: `${height}px` }}
            transition={{
              duration: state === "thinking" ? 0.8 : 0.08,
              ease: "easeOut",
              delay: state === "thinking" ? i * 0.04 : 0,
              repeat: state === "thinking" ? Infinity : 0,
              repeatType: "mirror",
            }}
          />
        );
      })}
    </div>
  );
}
