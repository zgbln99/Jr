import { NextResponse } from "next/server";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireAdmin } from "@/lib/auth";
import { listEnabledRegions, type OcrRegion } from "@/lib/db";
import {
  cropRegion,
  extractAmounts,
  LAST_FRAME_PATH,
  runOcr,
} from "@/lib/stream-frame";

export const dynamic = "force-dynamic";

// Must match MIN_AMOUNT in /api/internal/frame — keep both in sync so
// the test view mirrors production behaviour.
const MIN_AMOUNT = 100;

// Runs OCR on the last captured frame using the currently enabled regions.
// Returns per-region raw text + extracted amounts AND the "pickedAmount"
// (first amount above MIN_AMOUNT) the production pipeline would actually
// use — with fallback to the region's cached last_amount when the fresh
// parse misses. Sum is Σ picked-or-cached.
export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await stat(LAST_FRAME_PATH);
  } catch {
    return NextResponse.json(
      { error: "Brak klatki. Kliknij najpierw 'Pobierz świeżą klatkę'." },
      { status: 400 },
    );
  }

  const regions = listEnabledRegions();
  if (regions.length === 0) {
    return NextResponse.json(
      { error: "Brak zdefiniowanych obszarów. Narysuj choć jeden prostokąt na klatce." },
      { status: 400 },
    );
  }

  const work = await mkdtemp(join(tmpdir(), "jrjr-ocr-test-"));
  try {
    const perRegion: Array<{
      id: number;
      name: string | null;
      amounts: number[];
      text: string;
      pickedAmount: number | null;
      usedAmount: number | null;
      source: "fresh" | "cached" | "missing";
    }> = [];

    for (const region of regions as OcrRegion[]) {
      const cropPath = join(work, `r${region.id}.png`);
      try {
        await cropRegion(LAST_FRAME_PATH, cropPath, region);
        const text = await runOcr(cropPath);
        const amounts = extractAmounts(text);
        const pickedAmount = amounts.find((a) => a >= MIN_AMOUNT) ?? null;
        const usedAmount =
          pickedAmount != null ? pickedAmount : region.last_amount ?? null;
        const source: "fresh" | "cached" | "missing" =
          pickedAmount != null
            ? "fresh"
            : region.last_amount != null
              ? "cached"
              : "missing";
        perRegion.push({
          id: region.id,
          name: region.name,
          amounts,
          text: text.trim().slice(0, 500),
          pickedAmount,
          usedAmount,
          source,
        });
      } catch (err) {
        perRegion.push({
          id: region.id,
          name: region.name,
          amounts: [],
          text: `!! ${err instanceof Error ? err.message : String(err)}`,
          pickedAmount: null,
          usedAmount: region.last_amount ?? null,
          source: region.last_amount != null ? "cached" : "missing",
        });
      }
    }

    const contributing = perRegion.filter((r) => r.usedAmount != null);
    const sum = contributing.reduce((s, r) => s + (r.usedAmount as number), 0);
    return NextResponse.json({
      regions: perRegion,
      sum,
      engine: (process.env.OCR_ENGINE || "tesseract").toLowerCase(),
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
