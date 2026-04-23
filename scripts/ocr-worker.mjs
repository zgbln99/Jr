#!/usr/bin/env node
// OCR worker for jrjr.pl
//
// What it does, every OCR_INTERVAL_MINUTES (default 5 min):
//   1. Grabs one frame from the live YouTube stream via yt-dlp + ffmpeg
//   2. Crops the bottom-left quadrant (where both counters live)
//   3. Runs OCR (PaddleOCR by default, Tesseract as fallback)
//   4. Extracts two PLN amounts, sums them
//   5. POSTs the sum to /api/internal/ocr on the Next.js server
//
// Requirements on the VPS:
//   - yt-dlp           (https://github.com/yt-dlp/yt-dlp)
//   - ffmpeg
//   - Python 3 with `paddleocr` (recommended) OR `tesseract` CLI (fallback)
//     PaddleOCR install:  pip install paddlepaddle paddleocr
//     Tesseract install:  apt install tesseract-ocr tesseract-ocr-pol
//
// Calibration:
//   If OCR picks the wrong numbers, tune CROP_* env vars (percentages of
//   the frame, 0..1). Defaults cover the whole left third / bottom third.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// -------- Config --------
const STREAM_URL =
  process.env.STREAM_URL || "https://www.youtube.com/live/UNAqqHIPbWA";
const INTERVAL_MIN = Math.max(1, Number(process.env.OCR_INTERVAL_MINUTES) || 5);
const ENGINE = (process.env.OCR_ENGINE || "paddle").toLowerCase();
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
const INTERNAL_TOKEN = process.env.SESSION_SECRET;

// Crop region = the donation widget overlay on the left side of the frame.
// The widget holds two counters we need:
//   * a green "live ticker" amount at the top (e.g. "247 454 zł")
//   * a red progress bar with the cumulative total (e.g. "5 851 146,29 zł")
// Values are fractions of width/height (0..1). Defaults cover roughly the
// left 55% width and lower 60% height — tune in .env if the overlay moves.
const CROP_X = clamp01(Number(process.env.CROP_X ?? 0));
const CROP_Y = clamp01(Number(process.env.CROP_Y ?? 0.4));
const CROP_W = clamp01(Number(process.env.CROP_W ?? 0.55));
const CROP_H = clamp01(Number(process.env.CROP_H ?? 0.6));

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

if (!INTERNAL_TOKEN || INTERNAL_TOKEN.length < 32) {
  console.error(
    "[ocr] SESSION_SECRET is required (min 32 chars) — same value as the Next.js app.",
  );
  process.exit(1);
}

console.log(
  `[ocr] starting · engine=${ENGINE} · interval=${INTERVAL_MIN}min · stream=${STREAM_URL}`,
);

// -------- Main loop --------

async function tick() {
  const workDir = mkdtempSync(join(tmpdir(), "jrjr-ocr-"));
  try {
    const framePath = join(workDir, "frame.jpg");
    const cropPath = join(workDir, "crop.png");

    await grabFrame(STREAM_URL, framePath);
    await cropFrame(framePath, cropPath);

    const text = await runOcr(cropPath);
    console.log("[ocr] raw text:", text.replace(/\s+/g, " ").slice(0, 300));

    const picked = pickCounterAmounts(text);
    if (picked.length === 0) {
      console.warn("[ocr] no amounts parsed — skipping this tick");
      return;
    }
    const sum = picked.reduce((s, v) => s + v, 0);
    console.log(
      `[ocr] amounts=${picked.map((n) => n.toFixed(2)).join(" + ")} = ${sum.toFixed(2)} PLN`,
    );

    await postToApi(sum, picked);
  } catch (err) {
    console.error("[ocr] tick failed:", err instanceof Error ? err.message : err);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function run(cmd, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d.toString()));
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr.trim() || stdout.trim()}`));
    });
    if (input !== undefined) p.stdin.end(input);
  });
}

async function grabFrame(streamUrl, outPath) {
  // For YouTube live streams, piping yt-dlp's muxed output into ffmpeg
  // fails ("Invalid data found when processing input") because yt-dlp
  // emits HLS segment metadata ffmpeg can't parse as a raw AV stream.
  // Standard fix: use `yt-dlp -g` to resolve the direct m3u8 URL and let
  // ffmpeg pull HLS segments itself.
  const { stdout } = await run("yt-dlp", [
    "-q",
    "-g",
    "-f", "best[height<=720]/best",
    "--no-warnings",
    streamUrl,
  ]);
  const urls = stdout.trim().split("\n").filter(Boolean);
  if (urls.length === 0) {
    throw new Error("yt-dlp returned no stream URL (is the stream still live?)");
  }
  // yt-dlp sometimes prints two URLs (video + audio). The first is video.
  const mediaUrl = urls[0];

  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    // 30-second read timeout so a bad HLS segment can't hang the worker
    "-rw_timeout", "30000000",
    "-i", mediaUrl,
    "-frames:v", "1",
    "-q:v", "2",
    outPath,
  ]);
}

async function cropFrame(inPath, outPath) {
  // Use ffmpeg to crop out the bottom-left region in one shot and upscale.
  const filter = `crop=iw*${CROP_W}:ih*${CROP_H}:iw*${CROP_X}:ih*${CROP_Y},scale=iw*2:ih*2:flags=lanczos`;
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-i", inPath,
    "-vf", filter,
    outPath,
  ]);
}

async function runOcr(imgPath) {
  if (ENGINE === "tesseract") return runTesseract(imgPath);
  try {
    return await runPaddle(imgPath);
  } catch (err) {
    console.warn("[ocr] PaddleOCR failed, falling back to Tesseract:", err.message);
    return runTesseract(imgPath);
  }
}

async function runPaddle(imgPath) {
  const script = `
import sys, json
from paddleocr import PaddleOCR
ocr = PaddleOCR(use_angle_cls=False, lang='pl', show_log=False)
result = ocr.ocr(sys.argv[1], cls=False)
out = []
for line in result or []:
    for item in (line or []):
        if not item: continue
        txt = item[1][0] if len(item) > 1 else ''
        if txt: out.append(txt)
print(json.dumps(out, ensure_ascii=False))
`.trim();
  const { stdout } = await run("python3", ["-c", script, imgPath]);
  const lines = JSON.parse(stdout.trim() || "[]");
  return lines.join("\n");
}

async function runTesseract(imgPath) {
  const { stdout } = await run("tesseract", [
    imgPath,
    "-",
    "-l",
    "pol+eng",
    "--psm",
    "6",
  ]);
  return stdout;
}

// -------- Amount parsing --------
//
// Handles formats like:
//   "6 123 456 zł", "6,123,456.00 PLN", "6.123.456", "6 123 456,78 zł"

const MIN_COUNTER_PLN = Number(process.env.OCR_MIN_AMOUNT ?? 10_000);
const MAX_COUNTER_PLN = Number(process.env.OCR_MAX_AMOUNT ?? 100_000_000);

export function extractAmounts(text) {
  const results = [];
  // Match runs of digits that may include thousand separators (space, dot, comma)
  // and an optional decimal tail (",.00" / ".00"), followed by PLN / zł.
  const regex =
    /((?:\d[\d\s.,]{2,})(?:[.,]\d{1,2})?)\s*(?:zł|pln|z[ł]|PLN)/gi;
  let m;
  while ((m = regex.exec(text)) != null) {
    const n = parseAmount(m[1]);
    if (n != null) results.push(n);
  }
  // Fallback: big standalone numbers (>= 1000) even without PLN suffix
  if (results.length < 2) {
    const fallback = /(\d{1,3}(?:[ .,]\d{3}){1,}(?:[.,]\d{1,2})?|\d{4,}(?:[.,]\d{1,2})?)/g;
    while ((m = fallback.exec(text)) != null) {
      const n = parseAmount(m[1]);
      if (n != null && n >= 1000 && !results.includes(n)) results.push(n);
    }
  }
  return results;
}

// Find "goal" amounts in the widget. Pattern: "X zł z Y zł" — we want to
// ignore Y (the target). Also accepts "z Y zł" on the same line without
// the leading "zł", and variants like "do celu Y zł".
export function extractGoals(text) {
  const goals = new Set();
  const patterns = [
    /\bz\s+((?:\d[\d\s.,]{2,})(?:[.,]\d{1,2})?)\s*(?:zł|pln)/gi,
    /celu?\s*:?\s*((?:\d[\d\s.,]{2,})(?:[.,]\d{1,2})?)\s*(?:zł|pln)/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) != null) {
      const n = parseAmount(m[1]);
      if (n != null) goals.add(n);
    }
  }
  return goals;
}

// Pick the two counter amounts we actually want to sum:
//   * drop amounts below OCR_MIN_AMOUNT (default 10 000 zł) — filters out the
//     individual donation ticker ("Michał 20 zł")
//   * drop amounts above OCR_MAX_AMOUNT (sanity check)
//   * drop amounts identified as "goal" via extractGoals()
//   * take the two largest unique remaining values
export function pickCounterAmounts(text) {
  const all = extractAmounts(text);
  const goals = extractGoals(text);
  const seen = new Set();
  const candidates = [];
  for (const n of all) {
    if (n < MIN_COUNTER_PLN || n > MAX_COUNTER_PLN) continue;
    if (goals.has(n)) continue;
    // De-dup exact repeats (OCR often sees the same number twice)
    const key = Math.round(n * 100);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(n);
  }
  // Two largest — keeps the "cumulative + live ticker" pair stable even if
  // the ticker temporarily outgrows something weird.
  candidates.sort((a, b) => b - a);
  return candidates.slice(0, 2);
}

function parseAmount(raw) {
  let s = raw.trim().replace(/\s/g, "");
  // Decide decimal separator: last "," or "." with 1-2 digits after
  const dec = s.match(/([.,])(\d{1,2})$/);
  if (dec) {
    const sep = dec[1];
    // Remove all other separators, keep the last one as decimal point.
    const head = s.slice(0, s.length - (dec[2].length + 1)).replace(/[.,\s]/g, "");
    s = head + "." + dec[2];
  } else {
    s = s.replace(/[.,\s]/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function postToApi(sum, breakdown) {
  const url = `${SITE_URL.replace(/\/$/, "")}/api/internal/ocr`;
  const note = `OCR ${breakdown.map((n) => n.toFixed(0)).join(" + ")}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": INTERNAL_TOKEN,
    },
    body: JSON.stringify({ amount: sum, note }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${url} -> ${res.status} ${text.slice(0, 200)}`);
  }
}

// --- Boot ---
if (process.env.OCR_DRY_RUN === "1") {
  // Print parse of supplied fixture text then exit (useful in tests)
  const fixture = process.argv[2] ? readFileSync(process.argv[2], "utf8") : "";
  const all = extractAmounts(fixture);
  const goals = [...extractGoals(fixture)];
  const picked = pickCounterAmounts(fixture);
  const sum = picked.reduce((s, v) => s + v, 0);
  console.log(
    JSON.stringify({ all, goals, picked, sum }, null, 2),
  );
  process.exit(0);
}

tick();
setInterval(tick, INTERVAL_MIN * 60_000);

// Graceful shutdown
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[ocr] received ${sig}, exiting`);
    process.exit(0);
  });
}

// Silence unused import for bundlers
void writeFileSync;
