#!/usr/bin/env bash
# Install Playwright + Chromium for the OCR worker's `playwright` source.
#
# Why: YouTube's 2026 anti-bot on VPS IPs blocks yt-dlp hard, even with
# fresh cookies. Driving a real Chromium via Playwright gives us a much
# better fingerprint — same IP, but real browser JS, real rendering,
# real user-agent. Combined with YT_COOKIES it usually gets past the
# gate where yt-dlp can't.
#
# Usage on the VPS:
#   sudo bash /var/www/jrjr/deploy/install-playwright.sh
#
# ~300 MB disk (chromium binary), ~400 MB RAM per tick (browser is
# launched and killed each time, not kept resident).
set -euo pipefail

SERVICE_USER=jrjr
APP_DIR=/var/www/jrjr

if [ "$(id -u)" -ne 0 ]; then
  echo "[playwright] run with sudo" >&2
  exit 1
fi

echo "[playwright] installing npm package"
sudo -u "$SERVICE_USER" -H bash -c "cd $APP_DIR && npm install --no-audit --no-fund playwright"

echo "[playwright] installing system libs Chromium needs"
# This must run as root — hits apt. The command is idempotent; re-running
# is cheap.
cd "$APP_DIR"
npx --yes playwright install-deps chromium

echo "[playwright] downloading Chromium binary"
# Binary goes into the jrjr user's cache, not into node_modules. Keeps
# the browser version pinned to the playwright library version.
sudo -u "$SERVICE_USER" -H bash -c "cd $APP_DIR && npx --yes playwright install chromium"

echo "[playwright] smoke test"
sudo -u "$SERVICE_USER" -H bash -c "cd $APP_DIR && node -e \"
(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto('https://example.com');
  const title = await p.title();
  console.log('[playwright] page title:', title);
  await b.close();
})();
\""

cat <<EOF

============================================================
Playwright ready.

Flip the worker over by editing /var/www/jrjr/.env:
  COUNTER_SOURCES=playwright

Optional knobs:
  PLAYWRIGHT_WAIT=5000   # ms to wait after video loads before screenshot
  YT_COOKIES=/var/www/jrjr/.cookies/youtube.txt   # already set if you did cookies

Then:
  sudo systemctl restart jrjr-ocr
  sudo journalctl -u jrjr-ocr -f
============================================================
EOF
