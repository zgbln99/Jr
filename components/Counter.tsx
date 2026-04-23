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
  const fromRef = useRef<number>(0);
  const toRef = useRef<number>(initial.amount);
  const startedRef = useRef<number>(0);

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
        /* keep last value */
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
    const step = (now: number) => {
      const t = Math.min(1, (now - startedRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(fromRef.current + (toRef.current - fromRef.current) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    fromRef.current = 0;
    toRef.current = initial.amount;
    startedRef.current = performance.now();
    animate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stale = data.updatedAt ? Date.now() - data.updatedAt > 15 * 60_000 : true;

  return (
    <div>
      <div
        className="display tnum text-white"
        style={{
          fontSize: "clamp(3.5rem, 14vw, 9rem)",
          lineHeight: 0.9,
          letterSpacing: "-0.035em",
        }}
      >
        {formatPLN(Math.round(displayed))}
      </div>

      <div className="mt-4 flex items-center gap-3 text-white/60 text-[13px]">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            stale ? "bg-yellow-400" : "bg-green-500"
          }`}
        />
        <span className="tnum">
          {data.source === "manual" ? "Potwierdzono ręcznie" : "Z transmisji"}
          {" · "}
          aktualizacja: {formatRelative(data.updatedAt)}
        </span>
      </div>
    </div>
  );
}
