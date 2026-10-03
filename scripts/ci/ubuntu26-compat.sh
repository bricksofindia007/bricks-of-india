#!/usr/bin/env bash
# Branch-only compatibility test (not for merge): can our jobs run on the next Ubuntu runner? Installs what the jobs
# install and runs offline checks only. Nothing posts, nothing is written anywhere. Usage: ubuntu26-compat.sh video|site
set -u
RESULTS=(); pass() { RESULTS+=("PASS | $1"); echo "PASS | $1"; }; fail() { RESULTS+=("FAIL | $1"); echo "FAIL | $1"; }
check() { local name=$1; shift; if "$@" > "/tmp/step.log" 2>&1; then pass "$name"; else fail "$name"; tail -15 /tmp/step.log | sed 's/^/    /'; fi; }
echo "runner: $(lsb_release -ds 2>/dev/null) | kernel $(uname -r)"

if [ "$1" = video ]; then
  sudo apt-get update -qq > /dev/null 2>&1
  for p in ffmpeg tesseract-ocr libgl1 libglib2.0-0 libglib2.0-0t64; do check "apt: $p" sudo apt-get install -y -qq "$p"; done
  check "python version (3.11 from setup-python)" python -c "import sys; assert sys.version_info[:2] == (3, 11), sys.version"
  check "pip: scripts/video/requirements.txt" pip install -q -r scripts/video/requirements.txt
  check "pip: social-automation/requirements.txt" pip install -q -r social-automation/requirements.txt
  check "pip: video test extras" pip install -q requests num2words pillow python-dotenv
  check "compile: every Python file in scripts/ and social-automation/" python -m compileall -q scripts social-automation
  for m in moviepy PIL numpy pytesseract googleapiclient google.oauth2 supabase requests dotenv; do check "import: $m" python -c "import $m"; done
  check "unit tests: video cadence" bash -c "cd scripts/video && python -m unittest test_cadence"
  check "unit tests: coherence judge" bash -c "cd scripts/video && python -m unittest test_coherence_judge test_article_coherence"
  check "unit tests: social Indian price" bash -c "cd social-automation && python -m unittest test_indian_price"
  check "unit tests: campaign post idempotency" bash -c "cd social-automation && python -m unittest test_post_prepared"
  check "ffmpeg: 1 s H.264 + AAC render" ffmpeg -loglevel error -y -f lavfi -i color=c=blue:s=1080x1920:d=1 -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -c:v libx264 -c:a aac /tmp/t.mp4
  check "moviepy: 1 s clip render" python -c "
from moviepy.editor import ColorClip
ColorClip((540, 960), color=(10, 40, 100), duration=1).write_videofile('/tmp/m.mp4', fps=24, codec='libx264', audio=False, logger=None)"
  check "tesseract: OCR a rendered word" python -c "
from PIL import Image, ImageDraw, ImageFont; import pytesseract
im = Image.new('RGB', (400, 120), 'white'); d = ImageDraw.Draw(im)
d.text((20, 30), 'BRICKS', fill='black', font=ImageFont.load_default(size=48))
t = pytesseract.image_to_string(im); assert 'BRICK' in t.upper(), t"
fi

if [ "$1" = site ]; then
  check "node version" node --version
  check "npm ci" npm ci --no-audit --no-fund
  check "unit tests (vitest)" npx vitest run
  check "type check (tsc)" npx tsc --noEmit -p .
  # build settings come from the job env: the same secrets the deploy build uses
  check "site build (next build)" npm run build
  check "Cloudflare bundle build (no deploy)" npx opennextjs-cloudflare build
fi

echo; echo "SUMMARY ($1): ${#RESULTS[@]} checks"; printf '%s\n' "${RESULTS[@]}"
