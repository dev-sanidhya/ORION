"use client";
import { useEffect, useState } from "react";
import { useOrionStore } from "@/lib/store";

export default function ClockWidget() {
  const [now, setNow] = useState(new Date());
  const location = useOrionStore((s) => s.location);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const date = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-1">
      <div className="text-4xl font-mono tracking-widest glow-cyan text-orion-cyan">
        {time}
      </div>
      <div className="text-xs text-orion-text tracking-wider uppercase">{date}</div>
      {location && (
        <div className="text-xs text-orion-dim tracking-wider mt-0.5">
          {location.city}, {location.country}
        </div>
      )}
    </div>
  );
}
