"use client";

import { useEffect, useState } from "react";
import { useOrionStore } from "@/lib/store";

export default function ClockWidget() {
  const [now, setNow] = useState(new Date());
  const location = useOrionStore((s) => s.location);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const date = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-1">
      <div className="font-mono text-3xl tracking-[0.18em] text-cyan-100 orion-text-glow sm:text-4xl">
        {time}
      </div>
      <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{date}</div>
      {location && (
        <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
          {location.city}, {location.country}
        </div>
      )}
    </div>
  );
}
