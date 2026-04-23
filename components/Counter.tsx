"use client";

import { useEffect, useRef, useState } from "react";

type CounterData = {
  amount: number;
  source: "ocr" | "manual";
  updatedAt: number | null;
};

function formatPLN(n: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatRelative(ts: number | null): string {
  if (!ts) return "—";
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "przed chwilą";
  if (mins < 60) return `${mins} min temu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  return `${days} dni temu`;
}

export function Counter({ initial }: { initial: CounterData }) {
  const [data, setData] = useState<CounterData>(initial);
  const [displayed, setDisplayed] = useState<number>(initial.amount);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef<number>(initial.amount);
  const toRef = useRef<number>(initial.amount);
  const startedRef = useRef<number>(0);

  // Poll every 30s — the server updates only every 5 min, but a short poll
  // window smooths out the "was just refreshed" UX.
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/counter", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as CounterData;
        if (cancelled) return;
        if (next.amount !== toRef.current) {
          fromRef.current = displayed;
          toRef.current = next.amount;
          startedRef.current = performance.now();
          if (rafRef.current == null) animate();
        }
        setData(next);
      } catch {
        /* network hiccup — keep last known value */
      }
    }

    const id = window.setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function animate() {
    const duration = 1400;
    const from = fromRef.current;
    const to = toRef.current;
    const startedAt = startedRef.current;
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (to - from) * eased;
      setDisplayed(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }

  // On mount, run initial count-up from zero
  useEffect(() => {
    fromRef.current = 0;
    toRef.current = initial.amount;
    startedRef.current = performance.now();
    animate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stale = data.updatedAt
    ? Date.now() - data.updatedAt > 15 * 60_000
    : true;

  return (
    <div className="flex flex-col items-center gap-4">
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/15 text-white/80 text-[12px]">
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${
              stale ? "bg-stripe-lemon" : "bg-stripe-success"
            } opacity-75 animate-pulse-slow`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              stale ? "bg-stripe-lemon" : "bg-stripe-success"
            }`}
          />
        </span>
        <span className="tracking-wide uppercase">
          {data.source === "manual" ? "Stan potwierdzony" : "Zebrano na żywo"}
        </span>
      </span>

      <div
        className="tnum text-white font-light text-center leading-none"
        style={{
          fontSize: "clamp(3rem, 12vw, 7.5rem)",
          letterSpacing: "-0.04em",
        }}
      >
        {formatPLN(Math.round(displayed))}
      </div>

      <p className="text-white/60 text-[13px] tnum">
        Aktualizacja: {formatRelative(data.updatedAt)} · odświeżane co 5 min
      </p>
    </div>
  );
}
