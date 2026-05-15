"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface NewsItem {
  title: string;
  summary: string;
}

const FEEDS = [
  { label: "WORLD", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  { label: "TECH", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { label: "INDIA", url: "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml" },
];

async function fetchRSS(url: string): Promise<NewsItem[]> {
  try {
    const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=5`);
    const data = await r.json();
    return (data.items || []).map((item: { title: string; description: string }) => ({
      title: item.title,
      summary: item.description?.replace(/<[^>]+>/g, "").slice(0, 120) || "",
    }));
  } catch {
    return [];
  }
}

export default function NewsStrip({ highlight = false }: { highlight?: boolean }) {
  const [headlines, setHeadlines] = useState<NewsItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeed(0);
  }, []);

  async function loadFeed(tabIdx: number) {
    setLoading(true);
    setActiveTab(tabIdx);
    const items = await fetchRSS(FEEDS[tabIdx].url);
    setHeadlines(items);
    setActiveIdx(0);
    setLoading(false);
  }

  // Auto-rotate headlines every 5 seconds
  useEffect(() => {
    if (headlines.length === 0) return;
    const t = setInterval(() => {
      setActiveIdx((i) => (i + 1) % headlines.length);
    }, 5000);
    return () => clearInterval(t);
  }, [headlines]);

  return (
    <div
      className="glow-border rounded-sm bg-orion-surface flex flex-col h-full overflow-hidden transition-all duration-300"
      style={{
        border: highlight ? "1px solid #00D4FF66" : "1px solid var(--orion-border, #1a3040)",
        boxShadow: highlight ? "0 0 20px #00D4FF18" : undefined,
      }}
    >
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-orion-border">
        <span className="text-xs text-orion-cyan tracking-widest">INTEL FEED</span>
        <div className="flex gap-2">
          {FEEDS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => loadFeed(i)}
              className="text-xs tracking-widest px-1.5 py-0.5 rounded-sm transition-colors"
              style={{
                color: activeTab === i ? "#00D4FF" : "#3A5A70",
                background: activeTab === i ? "rgba(0,212,255,0.1)" : "transparent",
                border: `1px solid ${activeTab === i ? "rgba(0,212,255,0.3)" : "transparent"}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between p-4 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-xs text-orion-dim tracking-widest"
            >
              FETCHING INTEL...
            </motion.div>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-2"
              >
                <p className="text-sm text-orion-text leading-relaxed line-clamp-3">
                  {headlines[activeIdx]?.title}
                </p>
                {headlines[activeIdx]?.summary && (
                  <p className="text-xs text-orion-dim leading-relaxed line-clamp-2">
                    {headlines[activeIdx].summary}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Dot indicators */}
            <div className="flex gap-1.5 mt-3">
              {headlines.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{
                    background: i === activeIdx ? "#00D4FF" : "#0D2040",
                    boxShadow: i === activeIdx ? "0 0 6px #00D4FF" : "none",
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
