#!/usr/bin/env node
// Home relay for jrjr.pl OCR counter.
//
// Strategy: Playwright opens YouTube in headless Chromium. We don't wait
// for the <video> element to paint — instead we SNIFF the network traffic
// and grab the first m3u8 HLS manifest URL the player requests. Then
// ffmpeg pulls one frame from that URL. That skirts around:
//   - the consent wall (player JS still fires the manifest request even
//     if the dialog is in the way),
//   - slow video first-paint,
//   - ad pre-rolls.
// Uses ffmpeg-static so Windows users don't need to install anything.

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
const INTERVAL = Math.max(1, Number(process.env.INTERVAL_MINUTES) || 5);
const DEBUG_DIR = process.env.DEBUG_DIR || join(process.cwd(), "debug");

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

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exit ${code}: ${stderr.slice(0, 400)}`));
    });
  });
}

// Playwright + network interception: open YouTube, capture the first
// googlevideo.com m3u8 manifest URL the player fetches, close the
// browser, then use ffmpeg to pull a frame from that manifest.
async function captureManifestUrl() {
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

    // Preemptive consent so player JS doesn't get gated by the dialog.
    const consent = [".youtube.com", ".google.com", "www.youtube.com"].flatMap(
      (domain) => [
        { name: "SOCS", value: "CAISEwgBEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg", domain, path: "/", secure: true, httpOnly: false, sameSite: "Lax" },
        { name: "CONSENT", value: "YES+cb", domain, path: "/", secure: true, httpOnly: false, sameSite: "Lax" },
      ],
    );
    await context.addCookies(consent);

    const page = await context.newPage();
    page.setDefaultTimeout(30_000);

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

    // Try a handful of URLs — some paths trigger the manifest request faster.
    const targets = [
      `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1`,
      `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`,
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    for (const target of targets) {
      if (manifestUrl) break;
      try {
        console.log(`[relay] opening ${target}`);
        await page.goto(target, { waitUntil: "domcontentloaded", timeout: 20_000 });
      } catch (err) {
        console.warn(`[relay] goto failed for ${target}: ${err.message}`);
        continue;
      }

      // Best-effort consent click
      try {
        await page
          .locator('button:has-text("Zaakceptuj wszystko"), button:has-text("Accept all")')
          .first()
          .click({ timeout: 1500 });
      } catch {}

      // Wait up to 20 s for the player to request the manifest. Poll
      // frequently so we can return the instant we see it.
      const deadline = Date.now() + 20_000;
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
  await run(ffmpegPath, [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-rw_timeout", "30000000",
    "-i", manifestUrl,
    "-frames:v", "1",
    "-q:v", "2",
    outPath,
  ]);
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

async function tick() {
  const workDir = join(tmpdir(), `jrjr-relay-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  const framePath = join(workDir, "frame.jpg");

  try {
    const t0 = Date.now();
    const manifestUrl = await captureManifestUrl();
    if (!manifestUrl) throw new Error("could not intercept m3u8 manifest");
    const sniffMs = Date.now() - t0;
    console.log(`[relay] manifest intercepted in ${sniffMs}ms`);

    const t1 = Date.now();
    await ffmpegGrabFrame(manifestUrl, framePath);
    const ffmpegMs = Date.now() - t1;

    const t2 = Date.now();
    const result = await uploadFrame(framePath);
    const uploadMs = Date.now() - t2;

    const sum = result.sum != null ? `${result.sum.toFixed(2)} PLN` : result.ocr || "?";
    console.log(
      `[relay] ${new Date().toISOString()}  sniff=${sniffMs}ms ffmpeg=${ffmpegMs}ms upload=${uploadMs}ms  sum=${sum}`,
    );
    if (result.perRegion) {
      for (const r of result.perRegion) {
        console.log(
          `[relay]   region ${r.id}${r.name ? ` (${r.name})` : ""}: ${
            r.amounts?.length ? r.amounts.join(", ") : "(none)"
          }`,
        );
      }
    }
  } catch (err) {
    console.error(
      `[relay] ${new Date().toISOString()}  FAIL: ${err instanceof Error ? err.message : err}`,
    );
  }
}

console.log(
  `[relay] starting · VPS=${VPS_URL} · stream=${STREAM_URL} · interval=${INTERVAL}min`,
);
await tick();
setInterval(tick, INTERVAL * 60_000);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[relay] received ${sig}, exiting`);
    process.exit(0);
  });
}
