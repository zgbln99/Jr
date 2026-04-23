"use client";

import { useEffect, useRef, useState } from "react";

type CounterData = {
  amount: number;
  source: "ocr" | "manual";
  updatedAt: number | null;
};

type WidgetProps = {
  initial: CounterData;
  // "transparent" (default, for OBS), "dark", "chroma"
  bg: "transparent" | "dark" | "chroma";
  // "white" (default), "charcoal", "red"
  text: "white" | "charcoal" | "red";
  // px multiplier for the main number — default 1. Use ?scale=0.7 for compact,
  // 1.5 for huge. OBS users will usually just resize the browser source and
  // leave scale at 1.
  scale: number;
  // show the "Zebrano" label above the number (default yes).
  label: boolean;
};

function formatPLN(n: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(n);
}

export function WidgetCounter({ initial, bg, text, scale, label }: WidgetProps) {
  const [displayed, setDisplayed] = useState<number>(initial.amount);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef<number>(0);
  const toRef = useRef<number>(initial.amount);
  const startedRef = useRef<number>(0);

  // Widget polls more aggressively than the main site so the OBS overlay
  // is always current. 8 s feels right: fresh, not hammering.
  useEffect(() => {
    let cancelled = false;
    async function pull() {
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
      } catch {
        /* keep last value */
      }
    }
    const id = window.setInterval(pull, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function animate() {
    const duration = 1500;
    const step = (now: number) => {
      const t = Math.min(1, (now - startedRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(fromRef.current + (toRef.current - fromRef.current) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else rafRef.current = null;
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

  const bgClass =
    bg === "dark"
      ? "bg-vf-charcoal"
      : bg === "chroma"
        ? "" /* inline style handles chroma green */
        : "";
  const bgStyle =
    bg === "chroma"
      ? { background: "#00ff00" }
      : bg === "transparent"
        ? { background: "transparent" }
        : undefined;

  const textClass =
    text === "charcoal" ? "text-vf-charcoal" : text === "red" ? "text-vf-red" : "text-white";

  // Style overrides — body bg + prevents any default site chrome leaking into
  // the widget, in case OBS loads this at an odd size.
  return (
    <>
      <style>{`
        html, body { background: ${bg === "chroma" ? "#00ff00" : "transparent"} !important; margin: 0; padding: 0; overflow: hidden; }
      `}</style>
      <div
        className={`${bgClass} fixed inset-0 flex items-center justify-center`}
        style={bgStyle}
      >
        <div className="flex flex-col items-center gap-4">
          {label ? (
            <p
              className={`eyebrow ${textClass} opacity-80`}
              style={{ fontSize: `${0.75 * scale}rem` }}
            >
              Zebrano dotychczas
            </p>
          ) : null}
          <div
            className={`display tnum ${textClass} text-center leading-none`}
            style={{
              fontSize: `clamp(${3 * scale}rem, ${16 * scale}vw, ${12 * scale}rem)`,
              letterSpacing: "-0.04em",
              textShadow:
                bg === "transparent"
                  ? "0 2px 8px rgba(0,0,0,0.4)"
                  : undefined,
            }}
          >
            {formatPLN(Math.round(displayed))}
          </div>
        </div>
      </div>
    </>
  );
}
