"use client";

import { useEffect, useRef, useState } from "react";
import { fireMilestoneConfetti, millionsCrossed } from "@/lib/confetti";

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
  shadow: "none" | "soft" | "strong";
  scale: number;
  label: boolean;
};

const SHADOWS = {
  none: "none",
  soft: "0 2px 10px rgba(0,0,0,0.45), 0 0 2px rgba(0,0,0,0.7)",
  strong:
    "0 6px 28px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.55), 0 0 3px rgba(0,0,0,0.9)",
} as const;

function splitAmount(n: number): { number: string; currency: string } {
  const full = new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(n);
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
  shadow,
  scale,
  label,
}: WidgetProps) {
  // Sit on the SSR-provided amount immediately. No 0→X wind-up — we
  // only animate the delta between successive polls.
  const [displayed, setDisplayed] = useState<number>(initial.amount);
  const [pulse, setPulse] = useState(false);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef<number>(initial.amount);
  const toRef = useRef<number>(initial.amount);
  const startedRef = useRef<number>(0);
  // Mirror of `displayed` so closures and RAF steps read the current
  // value without getting frozen on the SSR initial.
  const displayedRef = useRef<number>(initial.amount);

  function writeDisplayed(v: number) {
    displayedRef.current = v;
    setDisplayed(v);
  }

  useEffect(() => {
    let cancelled = false;
    async function pull() {
      try {
        const res = await fetch("/api/counter", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as CounterData;
        if (cancelled) return;
        // Monotonic on the viewer side too — the widget is the thing
        // that's broadcast into OBS overlays, so even a transient
        // decrease in the API response (DB restore, manual override to
        // a lower figure) is silently ignored. Viewer never sees a drop.
        if (next.amount <= toRef.current) return;

        const prevAmount = toRef.current;
        const crossed = millionsCrossed(prevAmount, next.amount);

        fromRef.current = displayedRef.current;
        toRef.current = next.amount;
        startedRef.current = performance.now();
        setPulse(true);
        window.setTimeout(() => setPulse(false), 1800);
        if (rafRef.current == null) animate();

        if (crossed > 0) {
          fireMilestoneConfetti().catch(() => {});
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
      writeDisplayed(fromRef.current + (toRef.current - fromRef.current) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(step);
  }

  const bgValue =
    bg === "chroma" ? "#00ff00" : bg === "dark" ? "#25282b" : "transparent";

  const textColor =
    text === "charcoal" ? "#25282b" : text === "red" ? "#e60000" : "#ffffff";
  const accentColor =
    accent === "white" ? textColor : accent === "none" ? textColor : "#e60000";

  const { number, currency } = splitAmount(Math.round(displayed));

  const numberShadow = SHADOWS[shadow];
  const labelShadow = shadow === "none" ? "none" : SHADOWS.soft;
  const pulseShadow = pulse
    ? `0 0 60px ${accentColor === "#e60000" ? "rgba(230,0,0,0.7)" : "rgba(255,255,255,0.5)"}`
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
            <div className="flex items-center gap-3">
              <span
                className="inline-block rounded-full animate-pulse"
                style={{
                  width: `${0.9 * scale}rem`,
                  height: `${0.9 * scale}rem`,
                  background: accentColor,
                }}
                aria-hidden
              />
              <p
                className="uppercase font-bold"
                style={{
                  color: textColor,
                  opacity: 0.9,
                  fontSize: `clamp(${1 * scale}rem, ${2.2 * scale}vw, ${1.9 * scale}rem)`,
                  letterSpacing: "0.12em",
                  textShadow: labelShadow,
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
