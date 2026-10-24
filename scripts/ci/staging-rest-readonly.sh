#!/usr/bin/env bash
# Read-only checks on the staging project through its public REST API, and the Worker secret names.
# Prints HTTP status and row count per table, and secret names only. Never prints a key or URL.
set -uo pipefail
case "${STAGING_SUPABASE_URL:-}" in *hqpaiarhmiocmjrzjhtw*) echo "REFUSED: production project"; exit 1;; esac
case "${STAGING_SUPABASE_URL:-}" in *vdixqwjiiifliepzufpc*) echo "target check: staging project confirmed (value not printed)";; *) echo "REFUSED: not the staging project"; exit 1;; esac
for t in reviews news_articles guides; do
  BODY=$(mktemp)
  CODE=$(curl -s -o "$BODY" -w '%{http_code}' "$STAGING_SUPABASE_URL/rest/v1/$t?select=id" \
    -H "apikey: $STAGING_SUPABASE_PUBLISHABLE_KEY" -H "Authorization: Bearer $STAGING_SUPABASE_PUBLISHABLE_KEY")
  ROWS=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(Array.isArray(j)?j.length:"n/a")}catch(e){console.log("n/a")}})' < "$BODY")
  echo "anon REST $t: status=$CODE rows=$ROWS"
  rm -f "$BODY"
done
echo "== Worker secret names (staging config)"
npx wrangler secret list --config wrangler.staging.jsonc --format json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{JSON.parse(s).forEach(x=>console.log(x.name))}catch(e){console.log("list not readable")}})'
