"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { useOrionStore } from "@/lib/store";

export default function TweetPreview() {
  const widgetData = useOrionStore((s) => s.widgetData);
  const text = (widgetData.text as string) ?? "";
  const [copied, setCopied] = useState(false);

  const chars = text.length;
  const remaining = 280 - chars;

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.3 }}
      className="rounded-sm flex flex-col gap-3"
      style={{
        background: "rgba(29,161,242,0.06)",
        border: "1px solid rgba(29,161,242,0.3)",
        boxShadow: "0 0 24px rgba(29,161,242,0.12)",
        padding: "16px",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: "#1DA1F2", fontSize: "14px" }}>𝕏</span>
          <span className="text-xs tracking-widest" style={{ color: "#1DA1F2" }}>TWEET DRAFT</span>
        </div>
        <span
          className="text-xs font-mono"
          style={{ color: remaining < 20 ? "#FF4444" : remaining < 60 ? "#FF9900" : "#555" }}
        >
          {remaining}
        </span>
      </div>

      {/* Tweet text */}
      <p className="text-sm leading-relaxed" style={{ color: "#C8E8F8" }}>{text}</p>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-orion-border">
        <motion.button
          onClick={copy}
          whileTap={{ scale: 0.95 }}
          className="text-xs px-3 py-1 rounded-sm tracking-widest transition-colors"
          style={{
            border: "1px solid rgba(29,161,242,0.4)",
            color: copied ? "#00FF88" : "#1DA1F2",
            background: "transparent",
          }}
        >
          {copied ? "COPIED ✓" : "COPY"}
        </motion.button>
        <span className="text-xs text-orion-dim self-center ml-1">Paste into X to post</span>
      </div>
    </motion.div>
  );
}
