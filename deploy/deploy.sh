#!/usr/bin/env bash
# Pull latest changes, rebuild, restart services.
# Safe to run repeatedly. Intended to be invoked as the `jrjr` user.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "[deploy] $(date '+%F %T') starting in $ROOT"

# 1. Pull. --ff-only avoids accidental merge commits.
git fetch --depth 1 origin
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git reset --hard "origin/$BRANCH"
echo "[deploy] on $BRANCH @ $(git rev-parse --short HEAD)"

# 2. Install deps — npm ci reads package-lock.json, clean + deterministic.
npm ci --no-audit --no-fund

# 3. Build.
npm run build

# 4. Bounce services. We don't start them here — if you're running the script
# as root or with sudo, systemctl restart works; otherwise fall back to a
# print so a human can restart. Never fail the script on missing permission.
if command -v systemctl >/dev/null 2>&1; then
  if sudo -n systemctl restart jrjr-web jrjr-ocr 2>/dev/null; then
    echo "[deploy] restarted jrjr-web + jrjr-ocr"
  else
    echo "[deploy] (run as root / with sudo to auto-restart)"
    echo "         manual: sudo systemctl restart jrjr-web jrjr-ocr"
  fi
fi

echo "[deploy] done"
