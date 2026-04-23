// Capture a single frame from the YouTube live stream. Used by the admin
// calibration UI and the test-OCR endpoint. The OCR worker has its own
// standalone implementation in scripts/ocr-worker.mjs because it runs as a
// plain Node process without the Next.js runtime.

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const LAST_FRAME_PATH = resolve(
  process.cwd(),
  process.env.LAST_FRAME_PATH || "./data/last-frame.jpg",
);

function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d.toString()));
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", rej);
    p.on("close", (code) => {
      if (code === 0) res({ stdout, stderr });
      else rej(new Error(`${cmd} exit ${code}: ${stderr.trim() || stdout.trim()}`));
    });
  });
}

export async function captureFrame(outPath: string = LAST_FRAME_PATH): Promise<string> {
  const streamUrl =
    process.env.STREAM_URL || "https://www.youtube.com/live/UNAqqHIPbWA";
  const cookies = process.env.YT_COOKIES;

  const ytArgs = [
    "-q",
    "-g",
    "-f",
    "best[height<=720]/best",
    "--no-warnings",
  ];
  if (cookies) ytArgs.push("--cookies", cookies);
  const extra = (process.env.YT_EXTRA_ARGS || "").split(" ").filter(Boolean);
  ytArgs.push(...extra, streamUrl);

  const { stdout } = await run("yt-dlp", ytArgs);
  const urls = stdout.trim().split("\n").filter(Boolean);
  if (urls.length === 0) {
    throw new Error("yt-dlp returned no stream URL (is the stream still live?)");
  }
  const mediaUrl = urls[0];

  mkdirSync(dirname(outPath), { recursive: true });
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-rw_timeout",
    "30000000",
    "-i",
    mediaUrl,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outPath,
  ]);
  return outPath;
}

// Crop a region (given as 0..1 fractions of the frame) from srcPath to dstPath.
// Upscaled 2× with lanczos so OCR engines see bigger digits.
export async function cropRegion(
  srcPath: string,
  dstPath: string,
  region: { x: number; y: number; width: number; height: number },
) {
  const { x, y, width, height } = region;
  const filter =
    `crop=iw*${width}:ih*${height}:iw*${x}:ih*${y},` +
    `scale=iw*2:ih*2:flags=lanczos`;
  mkdirSync(dirname(dstPath), { recursive: true });
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    srcPath,
    "-vf",
    filter,
    dstPath,
  ]);
}

export async function runTesseract(imgPath: string): Promise<string> {
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

export async function runPaddle(imgPath: string): Promise<string> {
  const python = process.env.PADDLE_PYTHON || "python3";
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
  const { stdout } = await run(python, ["-c", script, imgPath]);
  const lines = JSON.parse(stdout.trim() || "[]");
  return (lines as string[]).join("\n");
}

export async function runOcr(imgPath: string): Promise<string> {
  const engine = (process.env.OCR_ENGINE || "tesseract").toLowerCase();
  if (engine === "tesseract") return runTesseract(imgPath);
  try {
    return await runPaddle(imgPath);
  } catch (err) {
    return runTesseract(imgPath);
  }
}

// Parse PLN amounts out of OCR text. Mirrors the logic in
// scripts/ocr-worker.mjs so the admin "test" endpoint agrees with what
// the worker will compute.
export function extractAmounts(text: string): number[] {
  const results: number[] = [];
  const primary = /((?:\d[\d\s.,]{2,})(?:[.,]\d{1,2})?)\s*(?:zł|pln|z[ł]|PLN)/gi;
  let m: RegExpExecArray | null;
  while ((m = primary.exec(text)) != null) {
    const n = parseAmount(m[1]);
    if (n != null) results.push(n);
  }
  if (results.length < 2) {
    const fallback =
      /(\d{1,3}(?:[ .,]\d{3}){1,}(?:[.,]\d{1,2})?|\d{4,}(?:[.,]\d{1,2})?)/g;
    while ((m = fallback.exec(text)) != null) {
      const n = parseAmount(m[1]);
      if (n != null && n >= 1000 && !results.includes(n)) results.push(n);
    }
  }
  return results;
}

function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, "");
  const dec = s.match(/([.,])(\d{1,2})$/);
  if (dec) {
    const head = s.slice(0, s.length - (dec[2].length + 1)).replace(/[.,\s]/g, "");
    s = head + "." + dec[2];
  } else {
    s = s.replace(/[.,\s]/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
