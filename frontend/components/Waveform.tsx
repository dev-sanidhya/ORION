"use client";
import { motion } from "framer-motion";
import { useOrionStore, AssistantState } from "@/lib/store";

const BAR_COUNT = 20;

const STATE_CONFIG: Record<AssistantState, { color: string; animate: boolean; heights: number[] }> = {
  idle: {
    color: "#00D4FF33",
    animate: false,
    heights: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  },
  listening: {
    color: "#00FF88",
    animate: true,
    heights: [8, 16, 24, 32, 20, 28, 36, 24, 16, 28, 32, 20, 28, 16, 24, 32, 20, 16, 24, 12],
  },
  thinking: {
    color: "#FF9900",
    animate: true,
    heights: [6, 10, 8, 12, 6, 10, 8, 12, 6, 10, 8, 12, 6, 10, 8, 12, 6, 10, 8, 12],
  },
  speaking: {
    color: "#0088FF",
    animate: true,
    heights: [12, 28, 36, 20, 32, 16, 40, 24, 32, 20, 28, 36, 16, 28, 20, 32, 24, 16, 28, 12],
  },
};

export default function Waveform() {
  const state = useOrionStore((s) => s.state);
  const config = STATE_CONFIG[state];

  return (
    <div className="flex items-center justify-center gap-0.5 h-12">
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const baseHeight = config.heights[i] ?? 4;
        return (
          <motion.div
            key={i}
            className="rounded-full w-1"
            style={{ backgroundColor: config.color }}
            animate={
              config.animate
                ? {
                    height: [
                      `${baseHeight}px`,
                      `${Math.min(baseHeight * 1.8, 40)}px`,
                      `${baseHeight * 0.6}px`,
                      `${baseHeight}px`,
                    ],
                  }
                : { height: `${baseHeight}px` }
            }
            transition={
              config.animate
                ? {
                    duration: 0.8 + (i % 5) * 0.12,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.04,
                  }
                : { duration: 0.3 }
            }
          />
        );
      })}
    </div>
  );
}
