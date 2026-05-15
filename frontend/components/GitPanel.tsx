"use client";
import { motion } from "framer-motion";
import { useOrionStore } from "@/lib/store";

export default function GitPanel() {
  const widgetData = useOrionStore((s) => s.widgetData);
  const commits = (widgetData.commits as string[]) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="glow-border rounded-sm bg-orion-surface flex flex-col gap-2 flex-1 overflow-hidden"
      style={{
        border: "1px solid #00FF8844",
        boxShadow: "0 0 20px #00FF8811",
        padding: "16px",
      }}
    >
      <div className="flex items-center justify-between border-b border-orion-border pb-2">
        <span className="text-xs text-green-400 tracking-widest">GIT LOG</span>
        <span className="text-xs text-orion-dim">ORION</span>
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto">
        {commits.length === 0 ? (
          <span className="text-xs text-orion-dim tracking-wider">No recent commits.</span>
        ) : (
          commits.map((line, i) => {
            const [hash, ...rest] = line.split(" ");
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-2 items-start"
              >
                <span className="text-xs font-mono text-green-400 shrink-0">{hash}</span>
                <span className="text-xs text-orion-dim font-mono leading-relaxed">{rest.join(" ")}</span>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
