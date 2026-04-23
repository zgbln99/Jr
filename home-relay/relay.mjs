#!/usr/bin/env node
// Home relay for jrjr.pl OCR counter.
// Runs on a residential-IP machine, so YouTube serves the player normally.

import { chromium } from "playwright";
import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
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

function urlFor(strategy) {
  if (strategy === "nocookie") {
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1`;
  }
  if (strategy === "embed") {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
  }
  if (strategy === "watch") {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return null;
}

async function dumpDebug(page, label, reason) {
  try {
    mkdirSync(DEBUG_DIR, { recursive: true });
    const stamp = `${label}-${Date.now()}`;
    const url = page.url();
    await page.screenshot({ path: join(DEBUG_DIR, `${stamp}.png`), fullPage: true });
    const html = await page.content();
    writeFileSync(join(DEBUG_DIR, `${stamp}.html`), html);
    writeFileSync(
      join(DEBUG_DIR, `${stamp}.txt`),
      `reason: ${reason}\nurl: ${url}\nrequested: ${STREAM_URL}\n`,
    );
    const sniff = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300);
    console.error(`[relay] debug saved to ${DEBUG_DIR}\\${stamp}.{png,html,txt}`);
    console.error(`[relay] page URL: ${url}`);
    console.error(`[relay] text sniff: ${sniff}`);
  } catch (err) {
    console.error(`[relay] debug dump failed: ${err.message}`);
  }
}

async function grabFrameWithStrategies(outPath) {
  const strategies = ["nocookie", "embed", "watch"];
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  let lastError = null;
  try {
    for (const strategy of strategies) {
      const target = urlFor(strategy);
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
        locale: "pl-PL",
        timezoneId: "Europe/Warsaw",
      });

      // Preemptive consent cookies — "I already clicked Accept All".
      const consent = [".youtube.com", ".google.com", "www.youtube.com"].flatMap(
        (domain) => [
          {
            name: "SOCS",
            value: "CAISEwgBEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg",
            domain,
            path: "/",
            secure: true,
            httpOnly: false,
            sameSite: "Lax",
          },
          {
            name: "CONSENT",
            value: "YES+cb",
            domain,
            path: "/",
            secure: true,
            httpOnly: false,
            sameSite: "Lax",
          },
        ],
      );
      await context.addCookies(consent);

      const page = await context.newPage();
      page.setDefaultTimeout(30_000);

      try {
        console.log(`[relay] strategy=${strategy} → ${target}`);
        await page.goto(target, { waitUntil: "domcontentloaded" });

        // Try to click "Zaakceptuj wszystko" in any frame.
        const tryClick = async (root) => {
          const selectors = [
            'button:has-text("Zaakceptuj wszystko")',
            'button:has-text("Accept all")',
            'button[aria-label*="Zaakceptuj" i]',
            'button[aria-label*="accept all" i]',
          ];
          for (const sel of selectors) {
            try {
              await root.locator(sel).first().click({ timeout: 1200 });
              return true;
            } catch {}
          }
          return false;
        };
        if (await tryClick(page)) {
          console.log("[relay] clicked consent 'Zaakceptuj wszystko'");
          await page.waitForTimeout(1000);
        } else {
          for (const frame of page.frames()) {
            if (await tryClick(frame)) {
              console.log("[relay] clicked consent in iframe");
              await page.waitForTimeout(1000);
              break;
            }
          }
        }

        await Promise.race([
          page.waitForFunction(
            () => {
              const v = document.querySelector("video");
              return v && v.videoWidth > 0 && v.videoHeight > 0;
            },
            null,
            { timeout: 25_000 },
          ),
          page
            .waitForFunction(
              () =>
                /confirm you.?re not a bot|sign in to confirm|potwierdzić.*bot/i.test(
                  document.body?.innerText || "",
                ),
              null,
              { timeout: 25_000 },
            )
            .then(() => {
              throw new Error("bot-check intercepted");
            }),
        ]);
        await page.waitForTimeout(WAIT_AFTER);

        const videoHandle = await page.$("video");
        if (videoHandle) {
          await videoHandle.screenshot({ path: outPath });
        } else {
          await page.screenshot({ path: outPath, fullPage: false });
        }

        console.log(`[relay] strategy=${strategy} OK`);
        await context.close();
        return;
      } catch (err) {
        lastError = err;
        console.error(`[relay] strategy=${strategy} failed: ${err.message}`);
        await dumpDebug(page, strategy, err.message).catch(() => {});
        await context.close();
      }
    }
    throw lastError || new Error("all strategies exhausted");
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
    await grabFrameWithStrategies(pngPath);
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
