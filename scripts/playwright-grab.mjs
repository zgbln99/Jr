#!/usr/bin/env node
// Grab one frame from a YouTube live stream using headless Chromium.
//
// Usage:
//   node scripts/playwright-grab.mjs <streamUrl> <outPath>
//
// Env:
//   YT_COOKIES             Netscape cookies.txt path (recommended).
//   PLAYWRIGHT_WAIT        ms to wait after video is ready (default 4000).
//   PLAYWRIGHT_STRATEGIES  comma list: "embed,watch" (default).
//
// On every failure we dump the current page URL, a full-page screenshot
// and the rendered HTML to /tmp/pw-debug/<label>-<ts>.* so you can see
// what YouTube actually served us (bot-check, consent wall, geo block…).

import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const rawStreamUrl = process.argv[2];
const outPath = process.argv[3];
if (!rawStreamUrl || !outPath) {
  console.error("usage: playwright-grab.mjs <streamUrl> <outPath>");
  process.exit(2);
}

const cookiesPath = process.env.YT_COOKIES;
const waitAfterReady = Number(process.env.PLAYWRIGHT_WAIT ?? 4000);
const strategies = (process.env.PLAYWRIGHT_STRATEGIES || "embed,watch")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

mkdirSync(dirname(outPath), { recursive: true });

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

const videoId = extractVideoId(rawStreamUrl);
if (!videoId) {
  console.error("Could not extract video ID from:", rawStreamUrl);
  process.exit(2);
}

function urlFor(strategy) {
  if (strategy === "embed") {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
  }
  if (strategy === "watch") {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  if (strategy === "nocookie") {
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1`;
  }
  return null;
}

function parseCookiesTxt(content) {
  const out = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
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

async function dumpDebug(page, label, reason) {
  try {
    const debugDir = "/tmp/pw-debug";
    mkdirSync(debugDir, { recursive: true });
    const stamp = `${label}-${Date.now()}`;
    const currentUrl = page.url();
    await page.screenshot({ path: `${debugDir}/${stamp}.png`, fullPage: true });
    const html = await page.content();
    writeFileSync(`${debugDir}/${stamp}.html`, html);
    writeFileSync(
      `${debugDir}/${stamp}.txt`,
      `reason: ${reason}\nurl: ${currentUrl}\nrequested: ${rawStreamUrl}\n`,
    );
    console.error(`[playwright] debug dumped to ${debugDir}/${stamp}.{png,html,txt}`);
    console.error(`[playwright] page URL at error: ${currentUrl}`);
    // Short HTML sniff — quick eyeball hint
    const sniff = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300);
    console.error(`[playwright] page text sniff: ${sniff}`);
  } catch (e) {
    console.error(`[playwright] debug dump itself failed: ${e.message}`);
  }
}

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--autoplay-policy=no-user-gesture-required",
    // YouTube treats OVH's entire IPv6 block as suspicious and serves a
    // reCAPTCHA / "Error 153" page. The VPS's IPv4 address is not on the
    // same blocklist. Force Chromium to resolve over IPv4 only.
    "--disable-ipv6",
  ],
});

let lastError = null;

try {
  for (const strategy of strategies) {
    const target = urlFor(strategy);
    if (!target) continue;
    console.log(`[playwright] trying strategy=${strategy} → ${target}`);

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      locale: "pl-PL",
      timezoneId: "Europe/Warsaw",
      deviceScaleFactor: 1,
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "languages", { get: () => ["pl-PL", "pl", "en"] });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    });

    if (cookiesPath && existsSync(cookiesPath)) {
      const cookies = parseCookiesTxt(readFileSync(cookiesPath, "utf8"));
      if (cookies.length > 0) await context.addCookies(cookies);
    }

    const page = await context.newPage();
    page.setDefaultTimeout(30_000);

    try {
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });

      // Dismiss consent dialog (EU) if present.
      try {
        await page
          .getByRole("button", { name: /zaakceptuj wszystko|accept all/i })
          .first()
          .click({ timeout: 3000 });
        await page.waitForTimeout(1500);
      } catch {}

      // Race: video with dimensions vs "bot check" text.
      await Promise.race([
        page.waitForFunction(
          () => {
            const v = document.querySelector("video");
            return v && v.videoWidth > 0 && v.videoHeight > 0;
          },
          null,
          { timeout: 30_000 },
        ),
        page
          .waitForFunction(
            () => /confirm you.?re not a bot|sign in to confirm/i.test(document.body?.innerText || ""),
            null,
            { timeout: 30_000 },
          )
          .then(() => {
            throw new Error("bot-check page intercepted");
          }),
      ]);

      await page.waitForTimeout(waitAfterReady);

      const videoHandle = await page.$("video");
      if (videoHandle) {
        await videoHandle.screenshot({ path: outPath });
      } else {
        await page.screenshot({ path: outPath, fullPage: false });
      }

      console.log(`[playwright] strategy=${strategy} saved ${outPath}`);
      await context.close();
      process.exit(0);
    } catch (err) {
      lastError = err;
      console.error(`[playwright] strategy=${strategy} failed: ${err.message}`);
      await dumpDebug(page, strategy, err.message).catch(() => {});
      await context.close();
      // Try next strategy.
    }
  }

  throw lastError || new Error("all strategies exhausted");
} finally {
  await browser.close();
}
