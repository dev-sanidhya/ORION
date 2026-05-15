"use client";

import { useState } from "react";
import { useOrionStore } from "@/lib/store";
import { orionSocket } from "@/lib/socket";

export default function ProjectSwitcher() {
  const active = useOrionStore((s) => s.activeProject);
  const available = useOrionStore((s) => s.availableProjects);
  const [open, setOpen] = useState(false);

  const others = available.filter((p) => p !== active);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.32em] text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-300/15"
      >
        <span className="orion-shimmer h-1.5 w-1.5 rounded-full bg-cyan-300" />
        <span>{active}</span>
        <span className="text-cyan-100/60">▾</span>
      </button>

      {open && others.length > 0 && (
        <div className="absolute right-0 z-30 mt-2 min-w-[160px] rounded-2xl border border-white/10 bg-slate-950/95 p-1.5 shadow-2xl">
          {others.map((name) => (
            <button
              key={name}
              onClick={() => {
                orionSocket.setProject(name);
                setOpen(false);
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-[11px] uppercase tracking-[0.3em] text-slate-300 transition hover:bg-cyan-300/10 hover:text-cyan-100"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
