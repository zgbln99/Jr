import { NextResponse } from "next/server";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  insertCounter,
  listEnabledRegions,
  setRegionLastAmount,
  type OcrRegion,
} from "@/lib/db";
import {
  cropRegion,
  extractAmounts,
  LAST_FRAME_PATH,
  runOcr,
} from "@/lib/stream-frame";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Minimum amount we trust as a "real" counter read. Below this the OCR
// most likely caught a timestamp, donation tip, or stray digits — not
// the actual running total. Keeps per-region memory sane.
const MIN_AMOUNT = 100;

export async function POST(req: Request) {
  const token = req.headers.get("x-internal-token");
  const expected = process.env.SESSION_SECRET;
  if (!expected || !token || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let buffer: Buffer | null = null;
  const ctype = (req.headers.get("content-type") || "").toLowerCase();
  try {
    if (ctype.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("frame");
      if (file instanceof File) {
        buffer = Buffer.from(await file.arrayBuffer());
      }
    } else {
      const ab = await req.arrayBuffer();
      if (ab.byteLength > 0) buffer = Buffer.from(ab);
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Nie udało się odczytać body", details: String(err) },
      { status: 400 },
    );
  }
  if (!buffer || buffer.length < 100) {
    return NextResponse.json({ error: "Brakuje klatki" }, { status: 400 });
  }

  mkdirSync(dirname(LAST_FRAME_PATH), { recursive: true });
  await writeFile(LAST_FRAME_PATH, buffer);

  const regions = listEnabledRegions();
  if (regions.length === 0) {
    return NextResponse.json({
      saved: true,
      ocr: "skipped — brak zdefiniowanych obszarów w /admin → Kalibracja OCR",
      frameBytes: buffer.length,
    });
  }

  const work = await mkdtemp(join(tmpdir(), "jrjr-ocr-push-"));
  try {
    // For each region, this run's OCR either produces a usable amount
    // (updates region.last_amount) or fails (falls back to the stored
    // last_amount). The summed total is Σ(current_or_last(region)).
    //
    // Regions that have never been parsed successfully AND don't parse
    // this tick are excluded entirely — we don't want a brand-new
    // untuned region to contribute 0 to what looks like a drop.
    type RegionResult = {
      id: number;
      name: string | null;
      parsedAmount: number | null;
      usedAmount: number | null;
      source: "fresh" | "cached" | "missing";
      rawAmounts: number[];
    };

    const perRegion: RegionResult[] = [];

    for (const region of regions as OcrRegion[]) {
      const cropPath = join(work, `r${region.id}.png`);
      let parsedAmount: number | null = null;
      let rawAmounts: number[] = [];

      try {
        await cropRegion(LAST_FRAME_PATH, cropPath, region);
        const text = await runOcr(cropPath);
        rawAmounts = extractAmounts(text);
        // First credible amount wins. User draws tight rectangles around
        // a single counter, so the first match is almost always the one
        // we want (vs. a goal number or donor suffix).
        const candidate = rawAmounts.find((a) => a >= MIN_AMOUNT);
        if (candidate != null) parsedAmount = candidate;
      } catch (err) {
        console.error(`[frame] region ${region.id} OCR failed:`, err);
      }

      let usedAmount: number | null;
      let source: RegionResult["source"];
      if (parsedAmount != null) {
        usedAmount = parsedAmount;
        source = "fresh";
        // Persist this as the new "last good" for future misses.
        try {
          setRegionLastAmount(region.id, parsedAmount);
        } catch (err) {
          console.error(`[frame] failed to persist last_amount for region ${region.id}:`, err);
        }
      } else if (region.last_amount != null) {
        usedAmount = region.last_amount;
        source = "cached";
      } else {
        usedAmount = null;
        source = "missing";
      }

      perRegion.push({
        id: region.id,
        name: region.name,
        parsedAmount,
        usedAmount,
        source,
        rawAmounts,
      });
    }

    const contributing = perRegion.filter((r) => r.usedAmount != null);
    if (contributing.length === 0) {
      return NextResponse.json({
        saved: true,
        ocr: "no regions have a known amount yet",
        perRegion,
      });
    }

    const sum = contributing.reduce((s, r) => s + (r.usedAmount as number), 0);
    const note =
      "home-relay " +
      contributing
        .map((r) => `${r.source === "cached" ? "~" : ""}${r.usedAmount?.toFixed(0)}`)
        .join(" + ");
    const row = insertCounter(sum, "ocr", note.slice(0, 500));

    return NextResponse.json({
      saved: true,
      ocr: "ok",
      sum,
      amounts: contributing.map((r) => r.usedAmount),
      perRegion,
      counterId: row.id,
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
