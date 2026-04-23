#!/usr/bin/env node
// Home relay for jrjr.pl OCR counter.
//
// Runs on your home PC (Windows / macOS / Linux). Every N minutes:
//   1. Opens a headless Chromium on YouTube via Playwright
//   2. Screenshots the <video> element showing the donation widget
//   3. POSTs the PNG to https://<vps>/api/internal/frame
// The VPS does the OCR and updates the public counter. We avoid the
// datacenter-IP block on YouTube because your home PC uses a normal
// residential IP.
//
// First run:
//   1. cp .env.example .env  (edit to match your VPS + secret)
//   2. npm install
//   3. npm run install-browsers
//   4. npm start
//
// Keep this process running. On Windows you can add a shortcut to
// start.cmd into shell:startup so it launches with the PC.

import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
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
const WAIT_AFTER = Number(process.env.PLAYWRIGHT_WAIT || 4000);

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
    const v = u.searchParams.get("v");
    if (v) return v;
  } catch {}
  return null;
}

const videoId = extractVideoId(STREAM_URL);
if (!videoId) {
  console.error("[relay] could not extract video id from STREAM_URL");
  process.exit(2);
}

async function grabFrame(outPath) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--disable-blink-features=AutomationControlled",
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

    // youtube-nocookie embed → no GDPR wall, no sign-in nag.
    const url = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1`;
    const page = await context.newPage();
    page.setDefaultTimeout(40_000);
    await page.goto(url, { waitUntil: "domcontentloaded" });

    await page.waitForFunction(
      () => {
        const v = document.querySelector("video");
        return v && v.videoWidth > 0 && v.videoHeight > 0;
      },
      null,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(WAIT_AFTER);

    const videoHandle = await page.$("video");
    if (videoHandle) {
      await videoHandle.screenshot({ path: outPath });
    } else {
      await page.screenshot({ path: outPath, fullPage: false });
    }
  } finally {
    await browser.close();
  }
}

async function uploadFrame(pngPath) {
  const body = readFileSync(pngPath);
  const res = await fetch(`${VPS_URL}/api/internal/frame`, {
    method: "POST",
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(body.length),
      "x-internal-token": SECRET,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`upload → ${res.status} ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function tick() {
  const workDir = join(tmpdir(), `jrjr-relay-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  const pngPath = join(workDir, "frame.png");
  try {
    const t0 = Date.now();
    await grabFrame(pngPath);
    const grabbedIn = Date.now() - t0;

    const t1 = Date.now();
    const result = await uploadFrame(pngPath);
    const uploadIn = Date.now() - t1;

    const sum = result.sum != null ? `${result.sum.toFixed(2)} PLN` : result.ocr || "?";
    console.log(
      `[relay] ${new Date().toISOString()}  grab=${grabbedIn}ms upload=${uploadIn}ms  sum=${sum}`,
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
  } finally {
    try {
      writeFileSync(join(workDir, ".cleanup"), ""); // no-op just to be defensive
    } catch {}
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
