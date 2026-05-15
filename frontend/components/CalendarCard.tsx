"use client";

import { useOrionStore } from "@/lib/store";
import SurfacePanel from "./SurfacePanel";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function relativeDay(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) return "Today";
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      d.getFullYear() === tomorrow.getFullYear() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getDate() === tomorrow.getDate();
    return isTomorrow ? "Tomorrow" : d.toLocaleDateString([], { weekday: "short" });
  } catch {
    return "";
  }
}

export default function CalendarCard() {
  const events = useOrionStore((s) => s.calendar);

  return (
    <SurfacePanel className="flex h-full flex-col gap-3 px-5 py-4 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.38em] text-cyan-100/75">Calendar</div>
          <div className="mt-1 text-sm uppercase tracking-[0.28em] text-slate-400">Next up</div>
        </div>
        <div className="orion-shimmer h-2 w-2 rounded-full bg-cyan-300" />
      </div>

      {events.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-center">
          <span className="text-xs uppercase tracking-[0.28em] text-slate-500">
            No events in the next 24h
          </span>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col gap-2 overflow-hidden">
          {events.slice(0, 4).map((e, i) => (
            <li
              key={`${e.title}-${e.start_iso}-${i}`}
              className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm text-slate-100">{e.title}</span>
                <span className="font-mono text-[11px] text-cyan-200/85">
                  {formatTime(e.start_iso)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-slate-500">
                <span>{relativeDay(e.start_iso)}</span>
                {e.location && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-600" />
                    <span className="truncate">{e.location}</span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SurfacePanel>
  );
}
