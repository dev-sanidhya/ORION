"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOrionStore } from "@/lib/store";

export default function ToastStack() {
  const toasts = useOrionStore((s) => s.toasts);
  const dismiss = useOrionStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    const t = setTimeout(() => dismiss(latest.id), 3500);
    return () => clearTimeout(t);
  }, [toasts, dismiss]);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto rounded-full border border-cyan-300/30 bg-slate-950/90 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-cyan-100 shadow-lg"
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
