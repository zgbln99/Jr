#!/usr/bin/env node
// Grab one frame from a YouTube live stream using headless Chromium (via
// Playwright). Used as an alternative to yt-dlp + ffmpeg when YouTube's
// VPS anti-bot refuses to resolve formats.
//
// Usage:
//   node scripts/playwright-grab.mjs <streamUrl> <outPath>
//
// Environment:
//   YT_COOKIES       optional path to Netscape cookies.txt — loaded into
//                    the browser context so we access the stream as a
//                    logged-in viewer.
//   PLAYWRIGHT_WAIT  milliseconds to wait after video is ready before
//                    screenshot (default 4000). Bigger = more time for
//                    any pre-roll ad to pass, but slower per tick.
//
// Exits non-zero with a message on stderr when something fails.

import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

const streamUrl = process.argv[2];
const outPath = process.argv[3];
if (!streamUrl || !outPath) {
  console.error("usage: playwright-grab.mjs <streamUrl> <outPath>");
  process.exit(2);
}

const cookiesPath = process.env.YT_COOKIES;
const waitAfterReady = Number(process.env.PLAYWRIGHT_WAIT ?? 4000);

mkdirSync(dirname(outPath), { recursive: true });

// Parse a Netscape cookies.txt into Playwright cookie objects.
function parseCookiesTxt(content) {
  const out = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    // Netscape format: domain \t includeSubdomains \t path \t secure \t expires \t name \t value
    const parts = line.split("\t");
    if (parts.length < 7) continue;
    const [domain, , path, secure, expires, name, value] = parts;
    const c = {
      name,
      value,
      domain,
      path: path || "/",
      secure: secure === "TRUE",
      httpOnly: false,
      sameSite: "Lax",
    };
    const exp = Number(expires);
    if (Number.isFinite(exp) && exp > 0) c.expires = exp;
    out.push(c);
  }
  return out;
}

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
  ],
});

try {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
  });

  // Try to look a bit less like a bot.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", { get: () => ["pl-PL", "pl", "en"] });
  });

  if (cookiesPath && existsSync(cookiesPath)) {
    const cookies = parseCookiesTxt(readFileSync(cookiesPath, "utf8"));
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }
  }

  const page = await context.newPage();
  page.setDefaultTimeout(45_000);

  await page.goto(streamUrl, { waitUntil: "domcontentloaded" });

  // Dismiss the consent dialog if YouTube shows one (EU).
  try {
    await page
      .getByRole("button", { name: /zaakceptuj wszystko|accept all/i })
      .first()
      .click({ timeout: 3000 });
  } catch {
    /* no consent dialog — fine */
  }

  // Wait for the <video> element to actually have dimensions = started playing.
  await page.waitForFunction(
    () => {
      const v = document.querySelector("video");
      return v && v.videoWidth > 0 && v.videoHeight > 0;
    },
    null,
    { timeout: 30_000 },
  );

  // Let the widget overlay finish compositing (live streamers re-draw the
  // overlay every second or two — give it at least one refresh cycle).
  await page.waitForTimeout(waitAfterReady);

  // Screenshot only the video element if we can; fall back to full page.
  const videoHandle = await page.$("video");
  if (videoHandle) {
    await videoHandle.screenshot({ path: outPath });
  } else {
    await page.screenshot({ path: outPath, fullPage: false });
  }

  console.log(`[playwright] saved ${outPath}`);
} finally {
  await browser.close();
}
