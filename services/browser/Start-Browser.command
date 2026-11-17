#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
trap 'code=$?; echo "Browser setup or startup failed (exit $code). Check the message above."; if [ -t 0 ]; then read -r -p "Press Enter to close"; fi' ERR

if ! command -v python3 >/dev/null; then
  echo 'Python 3 is required. Install it from python.org or with Homebrew, then retry.'
  read -r -p 'Press Enter to close'
  exit 1
fi
python3 -c 'import sys; exit(0 if sys.version_info >= (3, 10) else 1)' || {
  echo 'Python 3.10 or newer is required.'
  read -r -p 'Press Enter to close'
  exit 1
}
if ! command -v cloudflared >/dev/null; then
  echo 'Cloudflare Tunnel (cloudflared) is required to connect this Mac to your private hub.'
  echo 'Install it once using Cloudflare’s instructions, then run this setup again.'
  read -r -p 'Press Enter to close'
  exit 1
fi

if [ ! -f .env ]; then
  umask 077
  python3 - <<'PY'
from pathlib import Path
import secrets
Path('.env').write_text('ALLOWED_ORIGIN=https://chatgpt.ethan-grandpre0360.workers.dev\nBROWSER_SERVER_SECRET='+secrets.token_hex(48)+'\n')
PY
  chmod 600 .env
fi

if [ ! -d .venv ]; then python3 -m venv .venv; fi
.venv/bin/python -m pip install -r requirements.txt
DOCK_CHROME_BINARY="$(.venv/bin/python -c 'from server import chrome_path; print(chrome_path())')"
printf 'Using installed Chrome: %s\n' "$DOCK_CHROME_BINARY"
printf '\nKeep this Terminal window open. In another Terminal, run:\n'
printf 'cloudflared tunnel --url http://127.0.0.1:8788\n\n'
printf 'See README.md to connect the tunnel URL and secret to Cloudflare.\n\n'
exec .venv/bin/python server.py
