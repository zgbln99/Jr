#!/usr/bin/env bash
# Install PaddleOCR for the OCR worker.
#
# Why a venv: Ubuntu 25.04 ships Python 3.13 by default, but PaddlePaddle
# only publishes wheels for 3.9–3.12. We install a side-by-side Python 3.12
# (deadsnakes PPA, with a uv fallback) and put paddlepaddle + paddleocr in
# /var/www/jrjr/.venv. The OCR worker is then pointed at that interpreter
# via the PADDLE_PYTHON env var.
#
# Usage on the VPS:
#   sudo bash /var/www/jrjr/deploy/install-paddle.sh
#
# Idempotent: re-running just upgrades pip packages.
set -euo pipefail

VENV=/var/www/jrjr/.venv
SERVICE_USER=jrjr

if [ "$(id -u)" -ne 0 ]; then
  echo "[paddle] run with sudo" >&2
  exit 1
fi

# Native deps Paddle's runtime needs. libgl1 + libglib2.0-0 are required
# by opencv (Paddle pulls it in). libgomp1 is OpenMP for the CPU kernels.
echo "[paddle] installing system libs"
apt update
apt install -y libgomp1 libgl1 libglib2.0-0 software-properties-common

PY312=""

# Strategy A: Python 3.12 already on PATH.
if command -v python3.12 >/dev/null 2>&1; then
  PY312="$(command -v python3.12)"
  echo "[paddle] found existing python3.12 at $PY312"
fi

# Strategy B: deadsnakes PPA — usually has whatever Ubuntu plucky needs.
if [ -z "$PY312" ]; then
  echo "[paddle] adding deadsnakes PPA"
  if add-apt-repository -y ppa:deadsnakes/ppa 2>&1 | tee /tmp/dead.log \
     && apt update 2>&1 | tee -a /tmp/dead.log \
     && apt install -y python3.12 python3.12-venv python3.12-dev 2>&1 | tee -a /tmp/dead.log; then
    PY312="$(command -v python3.12)"
    echo "[paddle] installed python3.12 from deadsnakes at $PY312"
  else
    echo "[paddle] deadsnakes failed (see /tmp/dead.log) — falling back to uv"
  fi
fi

# Strategy C: uv installs Python interpreters on its own.
if [ -z "$PY312" ]; then
  echo "[paddle] installing uv"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
  uv python install 3.12
  PY312="$(uv python find 3.12)"
  echo "[paddle] uv-managed python3.12 at $PY312"
fi

if [ -z "$PY312" ] || [ ! -x "$PY312" ]; then
  echo "[paddle] FAILED to find python3.12" >&2
  exit 1
fi

# Build the venv as the service user so file ownership stays sane.
if [ ! -d "$VENV" ]; then
  echo "[paddle] creating venv at $VENV"
  sudo -u "$SERVICE_USER" "$PY312" -m venv "$VENV"
fi

echo "[paddle] upgrading pip / installing paddlepaddle + paddleocr"
sudo -u "$SERVICE_USER" "$VENV/bin/pip" install --upgrade pip wheel
sudo -u "$SERVICE_USER" "$VENV/bin/pip" install --upgrade paddlepaddle paddleocr

echo "[paddle] smoke test — first run downloads ~100 MB of detection / recognition models"
sudo -u "$SERVICE_USER" "$VENV/bin/python" - <<'PY'
import sys
from paddleocr import PaddleOCR
ocr = PaddleOCR(use_angle_cls=False, lang='pl', show_log=False)
print("paddle import + init OK", file=sys.stderr)
PY

cat <<EOF

============================================================
PaddleOCR ready.

Add to /var/www/jrjr/.env:
  OCR_ENGINE=paddle
  PADDLE_PYTHON=$VENV/bin/python

Then bounce the worker:
  sudo systemctl restart jrjr-ocr
  sudo journalctl -u jrjr-ocr -f
============================================================
EOF
