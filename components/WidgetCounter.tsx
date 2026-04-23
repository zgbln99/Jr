"use client";

import { useEffect, useRef, useState } from "react";

type CounterData = {
  amount: number;
  source: "ocr" | "manual";
  updatedAt: number | null;
};

type WidgetProps = {
  initial: CounterData;
  bg: "transparent" | "dark" | "chroma";
  text: "white" | "charcoal" | "red";
  accent: "red" | "white" | "none";
  scale: number;
  label: boolean;
};

function splitAmount(n: number): { number: string; currency: string } {
  const full = new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(n);
  // Split "6 098 600 zł" → ["6 098 600", "zł"]
  const m = full.match(/^(.+?)\s*(zł|PLN)\s*$/i);
  if (m) return { number: m[1].trim(), currency: m[2] };
  return { number: full, currency: "" };
}

const POLL_MS = 10_000;

export function WidgetCounter({
  initial,
  bg,
  text,
  accent,
  scale,
  label,
}: WidgetProps) {
  const [displayed, setDisplayed] = useState<number>(initial.amount);
  const [pulse, setPulse] = useState(false);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef<number>(0);
  const toRef = useRef<number>(initial.amount);
  const startedRef = useRef<number>(0);

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
          setPulse(true);
          window.setTimeout(() => setPulse(false), 1800);
          if (rafRef.current == null) animate();
        }
      } catch {}
    }
    const id = window.setInterval(pull, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function animate() {
    const duration = 1600;
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

  const bgValue =
    bg === "chroma" ? "#00ff00" : bg === "dark" ? "#25282b" : "transparent";

  const textColor =
    text === "charcoal" ? "#25282b" : text === "red" ? "#e60000" : "#ffffff";
  const accentColor =
    accent === "white" ? textColor : accent === "none" ? textColor : "#e60000";

  const { number, currency } = splitAmount(Math.round(displayed));

  // Drop shadow on transparent background so the number reads over any
  // overlay the streamer lays beneath it.
  const numberShadow =
    bg === "transparent"
      ? "0 4px 16px rgba(0,0,0,0.55), 0 0 2px rgba(0,0,0,0.85)"
      : "none";

  const pulseShadow = pulse
    ? `0 0 50px ${accentColor === "#e60000" ? "rgba(230,0,0,0.6)" : "rgba(255,255,255,0.4)"}`
    : "";

  return (
    <>
      <style>{`
        html, body {
          background: ${bgValue} !important;
          margin: 0;
          padding: 0;
          overflow: hidden;
          height: 100vh;
        }
      `}</style>
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: bgValue }}
      >
        <div className="flex flex-col items-center gap-3 md:gap-4">
          {label ? (
            <div className="flex items-center gap-2.5">
              <span
                className="inline-block rounded-full animate-pulse"
                style={{
                  width: `${0.55 * scale}rem`,
                  height: `${0.55 * scale}rem`,
                  background: accentColor,
                }}
                aria-hidden
              />
              <p
                className="uppercase tracking-[0.16em] font-bold"
                style={{
                  color: textColor,
                  opacity: 0.85,
                  fontSize: `${0.82 * scale}rem`,
                  textShadow: numberShadow,
                }}
              >
                Zebrano dotychczas
              </p>
            </div>
          ) : null}

          <div
            className="tnum text-center leading-none"
            style={{
              fontSize: `clamp(${3 * scale}rem, ${15 * scale}vw, ${13 * scale}rem)`,
              letterSpacing: "-0.04em",
              fontWeight: 800,
              textTransform: "uppercase",
              color: textColor,
              textShadow: [numberShadow, pulseShadow].filter(Boolean).join(", "),
              transition: "text-shadow 600ms ease",
            }}
          >
            <span>{number}</span>
            {currency ? (
              <span style={{ color: accentColor, marginLeft: "0.25em" }}>
                {currency}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
