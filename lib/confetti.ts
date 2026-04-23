"use client";

import type confettiFn from "canvas-confetti";

// Lazy-imported so the ~5 KB library never blocks first paint of the hero
// or the widget. First call awaits the dynamic import; subsequent calls
// reuse the cached module.
let confetti: typeof confettiFn | null = null;
async function getConfetti() {
  if (confetti) return confetti;
  const mod = await import("canvas-confetti");
  confetti = mod.default;
  return confetti;
}

const BRAND_COLORS = ["#e60000", "#ffffff", "#ffcc00", "#ff6a00"];

// Big burst for every full million-zł crossed. Shoots two cannons from the
// bottom-left and bottom-right corners so the number stays legible in the
// middle while confetti rains over the whole viewport.
export async function fireMilestoneConfetti() {
  const c = await getConfetti();
  const end = Date.now() + 2200;

  const shoot = () => {
    c({
      particleCount: 7,
      angle: 60,
      spread: 55,
      startVelocity: 60,
      origin: { x: 0, y: 0.85 },
      colors: BRAND_COLORS,
      disableForReducedMotion: true,
    });
    c({
      particleCount: 7,
      angle: 120,
      spread: 55,
      startVelocity: 60,
      origin: { x: 1, y: 0.85 },
      colors: BRAND_COLORS,
      disableForReducedMotion: true,
    });
  };

  // Initial big burst from center-top
  c({
    particleCount: 180,
    spread: 120,
    startVelocity: 48,
    origin: { y: 0.3 },
    colors: BRAND_COLORS,
    scalar: 1.1,
    disableForReducedMotion: true,
  });

  // Then keep shooting from corners for ~2 s
  const iv = window.setInterval(() => {
    if (Date.now() > end) {
      window.clearInterval(iv);
      return;
    }
    shoot();
  }, 180);
}

// Detect whether an amount jump crosses one or more whole-million marks.
// Returns the number of million-crossings (0 if none). Handles a single
// donation big enough to cross multiple millions in one go.
export function millionsCrossed(from: number, to: number): number {
  if (to <= from) return 0;
  const prevM = Math.floor(from / 1_000_000);
  const nextM = Math.floor(to / 1_000_000);
  return Math.max(0, nextM - prevM);
}
