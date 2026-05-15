"use client";

import { motion } from "framer-motion";
import { useOrionStore } from "@/lib/store";
import SurfacePanel from "@/components/SurfacePanel";

export default function GitPanel() {
  const widgetData = useOrionStore((s) => s.widgetData);
  const commits = (widgetData.commits as string[]) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.28 }}
      className="h-full"
    >
      <SurfacePanel className="flex h-full flex-col gap-4 px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between border-b border-emerald-300/10 pb-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.38em] text-emerald-200/80">Git Log</div>
            <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">Recent repository motion</div>
          </div>
          <span className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.26em] text-emerald-200">
            Live
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {commits.length === 0 ? (
            <span className="text-sm text-slate-400">No recent commits.</span>
          ) : (
            commits.map((line, index) => {
              const [hash, ...rest] = line.split(" ");
              return (
                <motion.div
                  key={`${hash}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="rounded-[20px] border border-white/8 bg-white/[0.035] px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-200">{hash}</span>
                    <span className="text-sm leading-6 text-slate-300">{rest.join(" ")}</span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </SurfacePanel>
    </motion.div>
  );
}
