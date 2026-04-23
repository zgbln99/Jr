#!/usr/bin/env node
// Home relay for jrjr.pl OCR counter.
//
// Two-tier capture:
//   FAST PATH — Playwright intercepts the live-stream manifest URL off
//     the wire at startup (and every MANIFEST_REFRESH_MINUTES, or after
//     ffmpeg fails twice). Subsequent ticks are just ffmpeg pulling a
//     frame from the cached URL. Cheap, can run every 10 seconds.
//   FALLBACK — if no manifest URL is intercepted within the timeout
//     (YouTube changes URL patterns occasionally), just screenshot the
//     <video> element on the Watch page and upload that. Slower per
//     tick but guaranteed whenever the video is actually rendering.

import { chromium } from "playwright";
import ffmpegPath from "ffmpeg-static";
import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

function loadEnv() {
  const path = ".env";
  if (!existsSync(path)) {
    console.error("[relay] .env not found — copy .env.example to .env and edit it");
    process.exit(2);
  }
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

const VPS_URL = (process.env.VPS_URL || "").replace(/\/$/, "");
const SECRET = process.env.SESSION_SECRET || "";
const STREAM_URL =
  process.env.STREAM_URL || "https://www.youtube.com/live/UNAqqHIPbWA";
const DEBUG_DIR = process.env.DEBUG_DIR || join(process.cwd(), "debug");
const DEBUG_REQUESTS = process.env.DEBUG_REQUESTS === "1";

const intervalMs = (() => {
  const secs = Number(process.env.INTERVAL_SECONDS);
  if (Number.isFinite(secs) && secs > 0) return Math.max(3000, secs * 1000);
  const mins = Number(process.env.INTERVAL_MINUTES);
  if (Number.isFinite(mins) && mins > 0) return mins * 60_000;
  return 10_000;
})();

const MANIFEST_REFRESH_MS =
  Number(process.env.MANIFEST_REFRESH_MINUTES || 30) * 60_000;

if (!VPS_URL || !SECRET) {
  console.error("[relay] VPS_URL and SESSION_SECRET must be set in .env");
  process.exit(2);
}

function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1);
    const parts = u.pathname.split("/").filter(Boolean);
    const liveIdx = parts.indexOf("live");
    if (liveIdx >= 0 && parts[liveIdx + 1]) return parts[liveIdx + 1];
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    const v = u.searchParams.get("v");
    if (v) return v;
  } catch {}
  return null;
}

const videoId = extractVideoId(STREAM_URL);
if (!videoId) {
  console.error("[relay] could not extract video id from STREAM_URL:", STREAM_URL);
  process.exit(2);
}

function runCmd(cmd, args, { timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const killer = timeoutMs
      ? setTimeout(() => {
          p.kill("SIGKILL");
          reject(new Error(`${cmd} timeout after ${timeoutMs}ms`));
        }, timeoutMs)
      : null;
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("error", (err) => {
      if (killer) clearTimeout(killer);
      reject(err);
    });
    p.on("close", (code) => {
      if (killer) clearTimeout(killer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exit ${code}: ${stderr.slice(0, 400)}`));
    });
  });
}

function manifestExpiresAt(url) {
  const m = url.match(/\/expire\/(\d+)/);
  if (!m) return null;
  const secs = Number(m[1]);
  if (!Number.isFinite(secs)) return null;
  return secs * 1000;
}

function isMediaUrl(u) {
  // HLS live manifest:
  //   manifest.googlevideo.com/api/manifest/hls_variant/.../file/index.m3u8
  //   manifest.googlevideo.com/api/manifest/hls_playlist/...
  // DASH manifest:
  //   manifest.googlevideo.com/api/manifest/dash/...
  // Direct progressive segment URLs:
  //   rr*.sn-*.googlevideo.com/videoplayback?...
  //   rr*.c.googlevideo.com/videoplayback?...
  return (
    /manifest\.googlevideo\.com\/api\/manifest\//i.test(u) ||
    /\.googlevideo\.com\/videoplayback/i.test(u)
  );
}

// Open Playwright, load the stream page, try to intercept a usable media
// URL from the player's network traffic. If nothing usable shows up in
// time, screenshot the <video> element and return a local JPEG instead.
//
// Return shape:
//   { kind: "url", url }     → ffmpeg pulls a frame from this on each tick
//   { kind: "screenshot",    → we already have the frame, use it directly
//     bytes }                   this tick; next tick re-invokes Playwright
async function captureFrameOrUrl(outJpegPath) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      locale: "pl-PL",
      timezoneId: "Europe/Warsaw",
    });

    const consent = [".youtube.com", ".google.com", "www.youtube.com"].flatMap(
      (domain) => [
        { name: "SOCS", value: "CAISEwgBEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg", domain, path: "/", secure: true, httpOnly: false, sameSite: "Lax" },
        { name: "CONSENT", value: "YES+cb", domain, path: "/", secure: true, httpOnly: false, sameSite: "Lax" },
      ],
    );
    await context.addCookies(consent);

    const page = await context.newPage();
    page.setDefaultTimeout(25_000);

    let capturedUrl = null;
    const googlevideoSeen = [];
    page.on("request", (req) => {
      const u = req.url();
      if (/googlevideo\.com/i.test(u)) {
        googlevideoSeen.push(u);
        if (DEBUG_REQUESTS) console.log("[req]", u.slice(0, 180));
        if (!capturedUrl && isMediaUrl(u)) {
          capturedUrl = u;
          console.log(`[relay] intercepted: ${u.slice(0, 140)}...`);
        }
      }
    });

    const targets = [
      `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1`,
      `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`,
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    for (const target of targets) {
      if (capturedUrl) break;
      try {
        await page.goto(target, { waitUntil: "domcontentloaded", timeout: 15_000 });
      } catch {}
      try {
        await page
          .locator('button:has-text("Zaakceptuj wszystko"), button:has-text("Accept all")')
          .first()
          .click({ timeout: 1500 });
      } catch {}
      const deadline = Date.now() + 12_000;
      while (!capturedUrl && Date.now() < deadline) {
        await page.waitForTimeout(200);
      }
    }

    if (capturedUrl) {
      return { kind: "url", url: capturedUrl };
    }

    // --- FALLBACK: no media URL intercepted, try to screenshot the video
    // element directly. This works whenever the <video> is actually
    // rendering pixels, which — per the debug artifact — it is.
    console.warn(
      `[relay] no media URL intercepted (saw ${googlevideoSeen.length} googlevideo requests), falling back to <video> screenshot`,
    );
    try {
      await page.waitForFunction(
        () => {
          const v = document.querySelector("video");
          return v && v.videoWidth > 0 && v.videoHeight > 0;
        },
        null,
        { timeout: 10_000 },
      );
      const handle = await page.$("video");
      if (handle) {
        await handle.screenshot({ path: outJpegPath, type: "jpeg", quality: 80 });
        console.log("[relay] captured <video> element screenshot directly");
        return { kind: "screenshot" };
      }
    } catch (err) {
      console.warn(`[relay] <video> screenshot failed: ${err.message}`);
    }

    // Nothing worked — dump a full debug artifact.
    try {
      mkdirSync(DEBUG_DIR, { recursive: true });
      const stamp = `no-manifest-${Date.now()}`;
      await page.screenshot({ path: join(DEBUG_DIR, `${stamp}.png`), fullPage: true });
      writeFileSync(join(DEBUG_DIR, `${stamp}.html`), await page.content());
      writeFileSync(
        join(DEBUG_DIR, `${stamp}.txt`),
        `googlevideo requests seen (${googlevideoSeen.length}):\n` +
          googlevideoSeen.slice(0, 50).join("\n"),
      );
      console.error(`[relay] debug saved to ${DEBUG_DIR}`);
    } catch {}
    return { kind: "none" };
  } finally {
    await browser.close();
  }
}

async function ffmpegGrabFrame(mediaUrl, outPath) {
  await runCmd(
    ffmpegPath,
    [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-rw_timeout", "15000000",
      "-i", mediaUrl,
      "-frames:v", "1",
      "-q:v", "3",
      outPath,
    ],
    { timeoutMs: 20_000 },
  );
}

async function uploadFrame(pngPath) {
  const body = readFileSync(pngPath);
  const res = await fetch(`${VPS_URL}/api/internal/frame`, {
    method: "POST",
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(body.length),
      "x-internal-token": SECRET,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`upload → ${res.status} ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// Cached state
let cachedUrl = null;
let cachedExpiresAt = 0;
let consecutiveFfmpegFails = 0;

async function ensureUrl(force, outJpegPath) {
  const now = Date.now();
  const cacheExpired = now > cachedExpiresAt - 60_000;
  if (!force && cachedUrl && !cacheExpired) {
    return { kind: "url", url: cachedUrl };
  }

  console.log(
    `[relay] refreshing media URL (force=${force}, cacheExpired=${cacheExpired})`,
  );
  const t0 = Date.now();
  const result = await captureFrameOrUrl(outJpegPath);
  if (result.kind === "none") throw new Error("could not capture media URL or frame");
  if (result.kind === "url") {
    cachedUrl = result.url;
    const signedExpiry = manifestExpiresAt(result.url);
    const maxAgeExpiry = now + MANIFEST_REFRESH_MS;
    cachedExpiresAt = Math.min(signedExpiry ?? Infinity, maxAgeExpiry);
    consecutiveFfmpegFails = 0;
    const ms = Date.now() - t0;
    const validForMin = Math.round((cachedExpiresAt - now) / 60_000);
    console.log(`[relay] new URL intercepted in ${ms}ms, valid for ~${validForMin} min`);
  } else {
    // screenshot fallback — no cacheable URL this cycle
    cachedUrl = null;
    cachedExpiresAt = 0;
    console.log(`[relay] screenshot fallback used (took ${Date.now() - t0}ms)`);
  }
  return result;
}

async function tick() {
  const workDir = join(tmpdir(), `jrjr-relay-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  const framePath = join(workDir, "frame.jpg");

  try {
    const result = await ensureUrl(false, framePath);

    if (result.kind === "url") {
      // Fast path: use cached URL + ffmpeg
      const t1 = Date.now();
      try {
        await ffmpegGrabFrame(cachedUrl, framePath);
      } catch (err) {
        consecutiveFfmpegFails += 1;
        console.warn(
          `[relay] ffmpeg failed (${consecutiveFfmpegFails}/2): ${err.message}`,
        );
        if (consecutiveFfmpegFails >= 2) {
          const refreshed = await ensureUrl(true, framePath);
          if (refreshed.kind === "url") {
            await ffmpegGrabFrame(cachedUrl, framePath);
          }
          // If refreshed.kind === "screenshot", the file is already written.
        } else {
          throw err;
        }
      }
      const ffmpegMs = Date.now() - t1;
      const t2 = Date.now();
      const apiResult = await uploadFrame(framePath);
      const uploadMs = Date.now() - t2;
      logTick(ffmpegMs, uploadMs, apiResult, "ffmpeg");
    } else {
      // Slow path: Playwright already wrote the screenshot, just upload
      const t2 = Date.now();
      const apiResult = await uploadFrame(framePath);
      const uploadMs = Date.now() - t2;
      logTick(0, uploadMs, apiResult, "browser");
    }
  } catch (err) {
    console.error(
      `[relay] FAIL: ${err instanceof Error ? err.message : err}`,
    );
  }
}

function logTick(ffmpegMs, uploadMs, apiResult, path) {
  const sum =
    apiResult.sum != null ? `${apiResult.sum.toFixed(2)} PLN` : apiResult.ocr || "?";
  const stamp = new Date().toISOString().slice(11, 19);
  const timings = ffmpegMs ? `ff=${ffmpegMs}ms up=${uploadMs}ms` : `up=${uploadMs}ms`;
  console.log(`[relay] ${stamp}  [${path}] ${timings}  ${sum}`);
}

console.log(
  `[relay] starting · VPS=${VPS_URL} · stream=${STREAM_URL} · interval=${(intervalMs / 1000).toFixed(0)}s`,
);

await tick();

(async function loop() {
  while (true) {
    await new Promise((r) => setTimeout(r, intervalMs));
    await tick();
  }
})();

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[relay] received ${sig}, exiting`);
    process.exit(0);
  });
}
