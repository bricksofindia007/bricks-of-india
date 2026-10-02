#!/usr/bin/env bash
# B2 (P14 round 7): run evidence goes to the PRIVATE repo bricksofindia007/boi-ops, never to a
# public artifact. Usage: push-to-boi-ops.sh <local dir or file> <dest path under runs/>
# Needs BOI_OPS_TOKEN (fine-grained PAT: boi-ops only, Contents read/write). Without it the
# evidence is not stored anywhere public: the step says so and exits 0 (the run's own result
# is unaffected). Prints counts only.
set -euo pipefail
SRC="$1"; DEST="runs/$2"
if [ ! -e "$SRC" ]; then echo "boi-ops: nothing to store ($SRC missing)"; exit 0; fi
if [ -z "${BOI_OPS_TOKEN:-}" ]; then echo "boi-ops: BOI_OPS_TOKEN not set; evidence not stored (kept out of public artifacts)"; exit 0; fi
W="$(mktemp -d)"
git clone -q --depth 1 "https://x-access-token:${BOI_OPS_TOKEN}@github.com/bricksofindia007/boi-ops.git" "$W" 2>/dev/null
mkdir -p "$W/$DEST"; cp -r "$SRC" "$W/$DEST/"
cd "$W"; git config user.name "boi-ops evidence"; git config user.email "actions@users.noreply.github.com"
git add -A; n=$(git diff --cached --name-only | wc -l)
[ "$n" -eq 0 ] && { echo "boi-ops: no new files"; exit 0; }
git commit -q -m "evidence: $DEST (${GITHUB_WORKFLOW:-local} run ${GITHUB_RUN_ID:-local})"
for i in 1 2 3 4 5; do git push -q 2>/dev/null && { echo "boi-ops: stored $n file(s) under $DEST"; exit 0; }; git pull -q --rebase 2>/dev/null || true; sleep $((i * 3)); done
echo "boi-ops: push failed after retries; evidence not stored"; exit 0
