#!/usr/bin/env node
// Home relay for jrjr.pl OCR counter.
//
// Strategy: launch Playwright ONCE at startup (and once per ~hour after
// that) to intercept the HLS manifest URL YouTube's player fetches. That
// URL is signed but stays valid for ~2 hours. Between refreshes, every
// tick is just ffmpeg pulling a frame from the cached manifest URL and
// uploading the JPEG to the VPS. That lets us run at 10-second cadence
// without paying the 5–10 s browser cold-start cost each time.

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

// Intervals: prefer INTERVAL_SECONDS for sub-minute polling. Falls back
// to INTERVAL_MINUTES for old configs.
const intervalMs = (() => {
  const secs = Number(process.env.INTERVAL_SECONDS);
  if (Number.isFinite(secs) && secs > 0) return Math.max(3000, secs * 1000);
  const mins = Number(process.env.INTERVAL_MINUTES);
  if (Number.isFinite(mins) && mins > 0) return mins * 60_000;
  return 10_000; // default: 10 seconds
})();

// Re-intercept the manifest after this long, OR on the first ffmpeg
// failure (signed URLs expire in ~2h). 30 min is a comfortable margin.
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

// Parse the `expire` query param out of an m3u8 manifest URL. YouTube
// signs these with a unix-epoch expiry — once it passes, ffmpeg starts
// returning 403. We use this to know when to re-intercept, without
// waiting for the failure.
function manifestExpiresAt(url) {
  const m = url.match(/\/expire\/(\d+)/);
  if (!m) return null;
  const secs = Number(m[1]);
  if (!Number.isFinite(secs)) return null;
  return secs * 1000;
}

async function interceptManifest() {
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

    // Preset consent cookies so the player JS isn't gated by the dialog.
    const consent = [".youtube.com", ".google.com", "www.youtube.com"].flatMap(
      (domain) => [
        { name: "SOCS", value: "CAISEwgBEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg", domain, path: "/", secure: true, httpOnly: false, sameSite: "Lax" },
        { name: "CONSENT", value: "YES+cb", domain, path: "/", secure: true, httpOnly: false, sameSite: "Lax" },
      ],
    );
    await context.addCookies(consent);

    const page = await context.newPage();
    page.setDefaultTimeout(25_000);

    let manifestUrl = null;
    page.on("request", (req) => {
      const u = req.url();
      if (
        /manifest\.googlevideo\.com\/api\/manifest\/hls/i.test(u) &&
        /\.m3u8(?:\?|$)/.test(u) &&
        !manifestUrl
      ) {
        manifestUrl = u;
      }
    });

    const targets = [
      `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1`,
      `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`,
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    for (const target of targets) {
      if (manifestUrl) break;
      try {
        await page.goto(target, { waitUntil: "domcontentloaded", timeout: 15_000 });
      } catch {}
      // Best-effort consent click
      try {
        await page
          .locator('button:has-text("Zaakceptuj wszystko"), button:has-text("Accept all")')
          .first()
          .click({ timeout: 1500 });
      } catch {}
      const deadline = Date.now() + 15_000;
      while (!manifestUrl && Date.now() < deadline) {
        await page.waitForTimeout(200);
      }
    }

    if (!manifestUrl) {
      try {
        mkdirSync(DEBUG_DIR, { recursive: true });
        const stamp = `no-manifest-${Date.now()}`;
        await page.screenshot({ path: join(DEBUG_DIR, `${stamp}.png`), fullPage: true });
        writeFileSync(join(DEBUG_DIR, `${stamp}.html`), await page.content());
        console.error(`[relay] debug saved to ${DEBUG_DIR}`);
      } catch {}
    }
    return manifestUrl;
  } finally {
    await browser.close();
  }
}

async function ffmpegGrabFrame(manifestUrl, outPath) {
  await runCmd(
    ffmpegPath,
    [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-rw_timeout", "15000000",
      "-i", manifestUrl,
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

// ----- Cached manifest URL state -----
let cachedManifest = null;
let cachedExpiresAt = 0;
let consecutiveFfmpegFails = 0;

async function ensureManifest(force = false) {
  const now = Date.now();
  const cacheExpired = now > cachedExpiresAt - 60_000; // 1 min safety margin
  if (!force && cachedManifest && !cacheExpired) return cachedManifest;

  console.log(`[relay] refreshing manifest URL (force=${force}, cacheExpired=${cacheExpired})`);
  const t0 = Date.now();
  const url = await interceptManifest();
  if (!url) throw new Error("could not intercept m3u8 manifest");
  cachedManifest = url;
  const signedExpiry = manifestExpiresAt(url);
  const maxAgeExpiry = now + MANIFEST_REFRESH_MS;
  cachedExpiresAt = Math.min(signedExpiry ?? Infinity, maxAgeExpiry);
  consecutiveFfmpegFails = 0;
  const ms = Date.now() - t0;
  const validForMin = Math.round((cachedExpiresAt - now) / 60_000);
  console.log(`[relay] new manifest intercepted in ${ms}ms, valid for ~${validForMin} min`);
  return cachedManifest;
}

async function tick() {
  const workDir = join(tmpdir(), `jrjr-relay-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  const framePath = join(workDir, "frame.jpg");

  try {
    let manifestUrl = await ensureManifest(false);

    const t1 = Date.now();
    try {
      await ffmpegGrabFrame(manifestUrl, framePath);
    } catch (err) {
      consecutiveFfmpegFails += 1;
      console.warn(
        `[relay] ffmpeg failed (${consecutiveFfmpegFails}/3): ${err.message}`,
      );
      if (consecutiveFfmpegFails >= 2) {
        // Assume manifest expired / rotated — force refresh and retry once.
        manifestUrl = await ensureManifest(true);
        await ffmpegGrabFrame(manifestUrl, framePath);
      } else {
        throw err;
      }
    }
    const ffmpegMs = Date.now() - t1;

    const t2 = Date.now();
    const result = await uploadFrame(framePath);
    const uploadMs = Date.now() - t2;

    const sum =
      result.sum != null ? `${result.sum.toFixed(2)} PLN` : result.ocr || "?";
    const stamp = new Date().toISOString().slice(11, 19);
    console.log(`[relay] ${stamp}  ff=${ffmpegMs}ms up=${uploadMs}ms  ${sum}`);
  } catch (err) {
    console.error(
      `[relay] FAIL: ${err instanceof Error ? err.message : err}`,
    );
  }
}

// ----- Boot -----
console.log(
  `[relay] starting · VPS=${VPS_URL} · stream=${STREAM_URL} · interval=${(intervalMs / 1000).toFixed(0)}s`,
);

// Run the first tick, which also lazily intercepts the manifest.
await tick();

// Steady-state loop. We use setTimeout chains (not setInterval) so a slow
// tick can't pile up — we always wait a full interval after each finishes.
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
