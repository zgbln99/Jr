import { NextResponse } from "next/server";
import { mkdtemp, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { insertCounter, listEnabledRegions, type OcrRegion } from "@/lib/db";
import {
  cropRegion,
  extractAmounts,
  LAST_FRAME_PATH,
  runOcr,
} from "@/lib/stream-frame";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Bigger than most Next.js API defaults — 720p PNGs weigh 300–600 KB,
// but we want comfortable headroom for higher-res screenshots too.
export const maxDuration = 60;

// Accepts a PNG/JPEG frame from the home-relay, saves it to
// data/last-frame.jpg, runs the regions-based OCR pipeline, stores the
// summed amount into counter_readings, and returns the breakdown so the
// relay can log what happened.
export async function POST(req: Request) {
  const token = req.headers.get("x-internal-token");
  const expected = process.env.SESSION_SECRET;
  if (!expected || !token || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Accept two upload styles:
  //   * multipart/form-data with field "frame"
  //   * raw body (image/png) — simpler for a curl / node fetch call
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

  // Persist the frame as the new "last seen" so the admin UI in
  // /admin → Kalibracja OCR reflects it.
  mkdirSync(dirname(LAST_FRAME_PATH), { recursive: true });
  await writeFile(LAST_FRAME_PATH, buffer);

  const regions = listEnabledRegions();
  if (regions.length === 0) {
    // No regions defined yet — the relay still uploaded a frame, which is
    // useful for calibrating in the admin. We just can't extract amounts
    // automatically until the user draws at least one rectangle.
    return NextResponse.json({
      saved: true,
      ocr: "skipped — brak zdefiniowanych obszarów w /admin → Kalibracja OCR",
      frameBytes: buffer.length,
    });
  }

  const work = await mkdtemp(join(tmpdir(), "jrjr-ocr-push-"));
  try {
    const allAmounts: number[] = [];
    const perRegion: Array<{
      id: number;
      name: string | null;
      amounts: number[];
    }> = [];

    for (const region of regions as OcrRegion[]) {
      const cropPath = join(work, `r${region.id}.png`);
      try {
        await cropRegion(LAST_FRAME_PATH, cropPath, region);
        const text = await runOcr(cropPath);
        const amounts = extractAmounts(text);
        perRegion.push({ id: region.id, name: region.name, amounts });
        allAmounts.push(...amounts);
      } catch (err) {
        perRegion.push({ id: region.id, name: region.name, amounts: [] });
        console.error(`[frame] region ${region.id} OCR failed:`, err);
      }
    }

    // De-dup repeats that land in multiple regions
    const seen = new Set<number>();
    const picked: number[] = [];
    for (const n of allAmounts) {
      const k = Math.round(n * 100);
      if (seen.has(k)) continue;
      seen.add(k);
      picked.push(n);
    }

    if (picked.length === 0) {
      return NextResponse.json({
        saved: true,
        ocr: "no amounts parsed",
        perRegion,
      });
    }

    const sum = picked.reduce((s, v) => s + v, 0);
    const note = `home-relay ${picked.map((n) => n.toFixed(0)).join(" + ")}`;
    const row = insertCounter(sum, "ocr", note.slice(0, 500));

    return NextResponse.json({
      saved: true,
      ocr: "ok",
      sum,
      amounts: picked,
      perRegion,
      counterId: row.id,
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

void stat;
void copyFileSync;
