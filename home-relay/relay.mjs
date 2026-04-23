#!/usr/bin/env node
// Home relay for jrjr.pl OCR counter.
//
// Approach: yt-dlp + ffmpeg. Playwright-based manifest interception
// couldn't distinguish HLS manifests from plain videoplayback segments
// for this live stream, so we hand YouTube URL resolution off to yt-dlp
// (which YouTube itself doesn't block from residential IPs) and let
// ffmpeg pull frames from whatever yt-dlp says is the current stream URL.
//
// Everything runs out of this folder. yt-dlp auto-downloads on first
// run; ffmpeg comes from the ffmpeg-static npm package.

import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { tmpdir, platform } from "node:os";
import { join } from "node:path";

// ---------- .env ----------
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

const intervalMs = (() => {
  const secs = Number(process.env.INTERVAL_SECONDS);
  if (Number.isFinite(secs) && secs > 0) return Math.max(3000, secs * 1000);
  const mins = Number(process.env.INTERVAL_MINUTES);
  if (Number.isFinite(mins) && mins > 0) return mins * 60_000;
  return 300_000; // default: 5 minutes
})();

const MANIFEST_REFRESH_MS =
  Number(process.env.MANIFEST_REFRESH_MINUTES || 30) * 60_000;

if (!VPS_URL || !SECRET) {
  console.error("[relay] VPS_URL and SESSION_SECRET must be set in .env");
  process.exit(2);
}

// ---------- helpers ----------
function runCmd(cmd, args, { timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
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

// ---------- yt-dlp auto-install ----------
async function ensureYtDlp() {
  const isWin = platform() === "win32";
  const isMac = platform() === "darwin";
  const binName = isWin ? "yt-dlp.exe" : "yt-dlp";
  const binPath = join(process.cwd(), binName);
  if (existsSync(binPath)) return binPath;

  const url = isWin
    ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    : isMac
      ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
      : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

  console.log(`[relay] downloading yt-dlp from GitHub (~10 MB)...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `yt-dlp download failed: HTTP ${res.status}. ` +
        `Pobierz ręcznie z ${url} i zapisz jako ${binName} obok relay.mjs.`,
    );
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(binPath, buffer);
  if (!isWin) chmodSync(binPath, 0o755);
  console.log(
    `[relay] yt-dlp saved to ${binPath} (${(buffer.length / 1e6).toFixed(1)} MB)`,
  );
  return binPath;
}

// ---------- fetch stream URL via yt-dlp ----------
async function resolveStreamUrl(ytdlpPath) {
  const args = [
    "-q",
    "-g",
    "-f",
    "best[height<=720]/best",
    "--no-warnings",
  ];
  const extra = (process.env.YT_EXTRA_ARGS || "").split(" ").filter(Boolean);
  args.push(...extra, STREAM_URL);

  const { stdout } = await runCmd(ytdlpPath, args, { timeoutMs: 30_000 });
  const urls = stdout.trim().split(/\r?\n/).filter(Boolean);
  if (urls.length === 0) throw new Error("yt-dlp returned no URL");
  // For combined formats yt-dlp prints one URL. For separate video+audio
  // it prints two — we only want the video for OCR.
  return urls[0];
}

// Parse the `expire` query param from a googlevideo URL.
function urlExpiresAt(url) {
  const m = url.match(/[?&]expire=(\d+)/);
  if (!m) return null;
  const secs = Number(m[1]);
  if (!Number.isFinite(secs)) return null;
  return secs * 1000;
}

// ---------- ffmpeg + upload ----------
async function ffmpegGrabFrame(mediaUrl, outPath) {
  await runCmd(
    ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-rw_timeout",
      "15000000",
      "-i",
      mediaUrl,
      "-frames:v",
      "1",
      "-q:v",
      "3",
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

// ---------- cached state ----------
let ytdlpBin = null;
let cachedUrl = null;
let cachedExpiresAt = 0;
let consecutiveFails = 0;

async function ensureUrl(force) {
  const now = Date.now();
  const cacheExpired = now > cachedExpiresAt - 60_000;
  if (!force && cachedUrl && !cacheExpired) return cachedUrl;

  console.log(
    `[relay] resolving stream URL via yt-dlp (force=${force}, cacheExpired=${cacheExpired})`,
  );
  const t0 = Date.now();
  if (!ytdlpBin) ytdlpBin = await ensureYtDlp();
  const url = await resolveStreamUrl(ytdlpBin);
  cachedUrl = url;
  const signedExpiry = urlExpiresAt(url);
  const maxAgeExpiry = now + MANIFEST_REFRESH_MS;
  cachedExpiresAt = Math.min(signedExpiry ?? Infinity, maxAgeExpiry);
  consecutiveFails = 0;
  const validMin = Math.round((cachedExpiresAt - now) / 60_000);
  console.log(`[relay] got URL in ${Date.now() - t0}ms, valid for ~${validMin} min`);
  return cachedUrl;
}

// ---------- tick ----------
async function tick() {
  const workDir = join(tmpdir(), `jrjr-relay-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  const framePath = join(workDir, "frame.jpg");

  try {
    let url = await ensureUrl(false);

    const t1 = Date.now();
    try {
      await ffmpegGrabFrame(url, framePath);
    } catch (err) {
      consecutiveFails += 1;
      console.warn(
        `[relay] ffmpeg failed (${consecutiveFails}/2): ${err.message.slice(0, 200)}`,
      );
      if (consecutiveFails >= 2) {
        url = await ensureUrl(true);
        await ffmpegGrabFrame(url, framePath);
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
      `[relay] FAIL: ${err instanceof Error ? err.message : err}`,
    );
  }
}

// ---------- boot ----------
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
