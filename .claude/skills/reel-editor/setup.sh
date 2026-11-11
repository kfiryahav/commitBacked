#!/usr/bin/env bash
# One-time setup for the reel-editor skill. Run it from the project folder you edit in; it works in ./reels/.
# Checks ffmpeg / Python 3 / Node, installs the Python libraries (into ./reels/.venv if the system Python
# lacks them), Playwright for the brand card (only if Node can't already load it), and generates the sound
# effects into ./reels/inputs/sfx. Safe to run again: it skips whatever is already there.
# usage: bash <skill>/setup.sh
set -euo pipefail
RE="$(cd "$(dirname "$0")" && pwd)"
WS=reels
mkdir -p "$WS"/inputs/sfx "$WS"/clips "$WS"/dist

missing=()
command -v ffmpeg >/dev/null || missing+=(ffmpeg)
command -v python3 >/dev/null || missing+=(python3)
command -v node >/dev/null || missing+=(node)
if [ ${#missing[@]} -gt 0 ]; then
  if command -v apt-get >/dev/null && [ "$(id -u)" = 0 ]; then
    pkgs="${missing[*]}"; pkgs="${pkgs/node/nodejs npm}"
    (apt-get install -y -qq $pkgs || (apt-get update -qq && apt-get install -y -qq $pkgs)) >/dev/null
  else
    echo "MISSING: ${missing[*]}"
    echo "  macOS:   brew install ${missing[*]}"
    echo "  Windows: use WSL 2 (Ubuntu): sudo apt install ffmpeg python3-venv nodejs npm"
    exit 1
  fi
fi
grep -q prores_ks <<<"$(ffmpeg -hide_banner -encoders 2>/dev/null)" || echo "WARNING: ffmpeg has no prores_ks encoder: the transparent brand card cannot render."
grep -q ' subtitles ' <<<"$(ffmpeg -hide_banner -filters 2>/dev/null)" || echo "WARNING: ffmpeg has no libass (subtitles filter): captions cannot be burned in."
# Liberation Serif is the italic accent on cards (numbers, quotes); Georgia is the fallback.
fc-list 2>/dev/null | grep -q "Liberation Serif" || { command -v apt-get >/dev/null && [ "$(id -u)" = 0 ] && apt-get install -y -qq fonts-liberation >/dev/null 2>&1 || true; }

# Python libraries. opencv<5: OpenCV 5 dropped the Haar face detector analyze.py uses.
LIBS=(numpy "opencv-python-headless<5" uharfbuzz fonttools faster-whisper)
CHECK="import numpy, cv2, uharfbuzz, fontTools, faster_whisper; assert cv2.__version__[0] == '4'"
if python3 -c "$CHECK" 2>/dev/null; then
  PY=python3
else
  [ -x "$WS/.venv/bin/python3" ] || python3 -m venv "$WS/.venv"
  "$WS/.venv/bin/python3" -c "$CHECK" 2>/dev/null || "$WS/.venv/bin/pip" install -q "${LIBS[@]}"
  PY="$WS/.venv/bin/python3"
fi

# Playwright renders the card. A global install (cloud containers have one) is used as is.
if ! (cd "$WS" && node -e "require('playwright')" 2>/dev/null); then
  (cd "$WS" && { [ -f package.json ] || echo '{"private":true}' > package.json; } && npm install --silent playwright && npx playwright install chromium)
fi

[ -f "$WS/inputs/sfx/whoosh.wav" ] || "$PY" "$RE/scripts/make_sfx.py" "$WS/inputs/sfx" >/dev/null
echo "reel-editor ready. Python: $PY"
