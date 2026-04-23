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
    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-[8px] bg-white/10 border border-white/15 backdrop-blur">
      <span className="text-white/70 text-[11px] uppercase tracking-[0.12em]">
        {finished ? "Transmisja zakończona" : "Koniec transmisji za"}
      </span>
      {!finished ? (
        <span className="tnum text-white text-[14px] font-normal">
          {parts.days}d {String(parts.hours).padStart(2, "0")}:
          {String(parts.minutes).padStart(2, "0")}:
          {String(parts.seconds).padStart(2, "0")}
        </span>
      ) : null}
    </div>
  );
}
