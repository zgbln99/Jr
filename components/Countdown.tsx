"use client";

import { useEffect, useState } from "react";
import { parseWarsawToMs } from "@/lib/time";

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function toParts(ms: number): Parts {
  const clamped = Math.max(0, ms);
  const s = Math.floor(clamped / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export function Countdown({ endsAt }: { endsAt: string | null }) {
  const end = parseWarsawToMs(endsAt);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!end) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [end]);

  if (end == null) return null;
  const parts = toParts(end - now);
  const finished = end - now <= 0;

  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 border border-white/30 rounded-full text-white/90 text-[11px] font-bold uppercase tracking-[0.14em]">
      {finished ? (
        "Transmisja zakończona"
      ) : (
        <>
          Koniec za{" "}
          <span className="tnum">
            {parts.days}d {String(parts.hours).padStart(2, "0")}:
            {String(parts.minutes).padStart(2, "0")}:
            {String(parts.seconds).padStart(2, "0")}
          </span>
        </>
      )}
    </span>
  );
}
