#!/usr/bin/env bash
# Reinstalls the video-editing toolchain in a fresh cloud session.
# Usage: bash video/tools/setup.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"

# 1. Transcription engine (word-level timestamps)
pip3 install -q faster-whisper fonttools brotli

# 2. Hebrew Google Fonts (via npm Fontsource; GitHub/Google Fonts are blocked by the network policy)
mkdir -p "$WORK/pkgs" "$WORK/tt" ~/.fonts/hebrew
cd "$WORK/pkgs"
for f in heebo rubik assistant secular-one fredoka varela-round alef suez-one karantina \
         bellefair frank-ruhl-libre noto-sans-hebrew amatic-sc playpen-sans-hebrew; do
  npm pack -q "@fontsource/$f" >/dev/null 2>&1 || echo "font download failed: $f"
done
mkdir -p x && for t in *.tgz; do mkdir -p "x/${t%.tgz}"; tar xzf "$t" -C "x/${t%.tgz}"; done
python3 "$HERE/mergefonts.py" "$WORK/pkgs/x" ~/.fonts/hebrew "$WORK/tt"
fc-cache -f

# 3. Hebrew Whisper model (needs huggingface.co allowed in the environment's network settings)
python3 -c "from huggingface_hub import snapshot_download; print(snapshot_download('ivrit-ai/whisper-large-v3-turbo-ct2'))" \
  || echo "WARNING: model download failed - allow huggingface.co in the environment network settings"
