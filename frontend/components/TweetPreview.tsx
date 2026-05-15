"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useOrionStore } from "@/lib/store";

export default function TweetPreview() {
  const widgetData = useOrionStore((s) => s.widgetData);
  const text = (widgetData.text as string) ?? "";
  const [copied, setCopied] = useState(false);

  const remaining = 280 - text.length;

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 10 }}
      transition={{ duration: 0.28 }}
      className="w-full max-w-xl rounded-[28px] border border-sky-300/20 bg-sky-300/[0.06] p-5 shadow-[0_30px_100px_rgba(8,20,40,0.45)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.32em] text-sky-100">
            X Draft
          </span>
          <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Quick share card</span>
        </div>
        <span
          className="font-mono text-sm"
          style={{ color: remaining < 20 ? "#FF6B7B" : remaining < 60 ? "#FFB55F" : "#8AA4BC" }}
        >
          {remaining}
        </span>
      </div>

      <p className="mt-5 text-base leading-8 text-slate-100">{text}</p>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
        <motion.button
          onClick={copy}
          whileTap={{ scale: 0.97 }}
          className="rounded-full border border-sky-300/25 bg-sky-300/10 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-sky-100 transition hover:bg-sky-300/15"
        >
          {copied ? "Copied" : "Copy"}
        </motion.button>
        <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Paste into X to post</span>
      </div>
    </motion.div>
  );
}
