"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SurfacePanel from "@/components/SurfacePanel";

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
    const response = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=5`,
    );
    const data = await response.json();
    return (data.items || []).map((item: { title: string; description: string }) => ({
      title: item.title,
      summary: item.description?.replace(/<[^>]+>/g, "").slice(0, 140) || "",
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

  useEffect(() => {
    if (headlines.length === 0) return;
    const timer = setInterval(() => {
      setActiveIdx((current) => (current + 1) % headlines.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [headlines]);

  return (
    <SurfacePanel
      className="flex h-full flex-col overflow-hidden px-5 py-5 sm:px-6"
      strong={highlight}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.38em] text-cyan-100/75">Intel Feed</div>
          <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">Rolling world brief</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FEEDS.map((feed, index) => {
            const active = activeTab === index;
            return (
              <button
                key={feed.label}
                onClick={() => loadFeed(index)}
                className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.32em] transition"
                style={{
                  color: active ? "#d8f6ff" : "#7a96ad",
                  border: active ? "1px solid rgba(121, 231, 255, 0.22)" : "1px solid rgba(255,255,255,0.08)",
                  background: active ? "rgba(121, 231, 255, 0.12)" : "rgba(255,255,255,0.03)",
                }}
              >
                {feed.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between pt-5">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <motion.div
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 1.1, repeat: Infinity }}
              className="text-[11px] uppercase tracking-[0.34em] text-slate-500"
            >
              Fetching intel
            </motion.div>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${activeIdx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
                className="space-y-4"
              >
                <p className="text-lg leading-8 text-slate-100">
                  {headlines[activeIdx]?.title ?? "No headlines available."}
                </p>
                {headlines[activeIdx]?.summary && (
                  <p className="text-sm leading-7 text-slate-400">{headlines[activeIdx].summary}</p>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex items-center justify-between gap-4">
              <div className="flex gap-2">
                {headlines.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveIdx(index)}
                    className="h-2 w-2 rounded-full transition-all"
                    style={{
                      background: index === activeIdx ? "#79e7ff" : "rgba(122, 150, 173, 0.45)",
                      boxShadow: index === activeIdx ? "0 0 14px rgba(121, 231, 255, 0.55)" : "none",
                      transform: index === activeIdx ? "scale(1.15)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                Auto rotates every 5s
              </span>
            </div>
          </>
        )}
      </div>
    </SurfacePanel>
  );
}
