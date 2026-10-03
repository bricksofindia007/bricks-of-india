#!/usr/bin/env bash
# Branch-only proof (not for merge): the same site built twice (cache interception off / on), served by a LOCAL
# wrangler dev (R2 + Durable Objects emulated on the runner; nothing touches production). For each page:
# request, repeat, restart the Worker (empties the in-memory map a new isolate would also lack), request, repeat.
# Prints only the cache header and the number of local cache writes per step.
set -uo pipefail
umask 077
printf 'NEXT_PUBLIC_SUPABASE_URL=%s\nNEXT_PUBLIC_SUPABASE_ANON_KEY=%s\nSUPABASE_SERVICE_ROLE_KEY=%s\nNEXT_PUBLIC_GA_MEASUREMENT_ID=%s\n' \
  "$NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_SERVICE_ROLE_KEY" "${NEXT_PUBLIC_GA_MEASUREMENT_ID:-}" > .dev.vars
cp .dev.vars .env.local
PAGES="/sets/40894 /news/lego-brick-rush-sale-every-in-store-deal-and-whether-it-beat /"
H=(-H 'x-forwarded-proto: https' -H 'user-agent: BOI-QualityBot/1 (+https://bricksofindia.com/bot)')

writes() { find .wrangler/state -type f -path '*r2*' -path '*blobs*' 2>/dev/null | wc -l; }
start_dev() {
  npx wrangler dev --local --port 8787 > "dev-$1.log" 2>&1 & echo $! > dev.pid
  for _ in $(seq 1 120); do curl -s -o /dev/null "${H[@]}" http://localhost:8787/bot && return 0; sleep 2; done
  echo "wrangler dev did not start ($1):"; tail -25 "dev-$1.log"; return 1
}
stop_dev() { kill "$(cat dev.pid)" 2>/dev/null; pkill -f workerd 2>/dev/null; pkill -f 'wrangler dev' 2>/dev/null; sleep 3; }
probe() {  # variant page step
  local hdr; hdr=$(curl -s -o /dev/null -D - "${H[@]}" "http://localhost:8787$2" | tr -d '\r')
  local st cache cc; st=$(echo "$hdr" | head -1 | cut -d' ' -f2)
  cache=$(echo "$hdr" | grep -i '^x-nextjs-cache:' | cut -d' ' -f2); cc=$(echo "$hdr" | grep -i '^cache-control:' | cut -d' ' -f2-)
  sleep 8   # let any background rebuild finish and write
  local w; w=$(writes)
  echo "$1 | $2 | $3 | HTTP $st | x-nextjs-cache=${cache:--} | ${cc:--} | cache writes so far=$w"
}
run_variant() {
  local name=$1 flag=$2
  sed -i -E "s/enableCacheInterception: (true|false)/enableCacheInterception: $flag/" open-next.config.ts
  grep -n 'enableCacheInterception' open-next.config.ts
  rm -rf .open-next .next .wrangler
  if ! npx opennextjs-cloudflare build > "build-$name.log" 2>&1; then echo "build failed ($name)"; tail -30 "build-$name.log"; return 1; fi
  for p in $PAGES; do
    start_dev "$name" || return 1
    probe "$name" "$p" "1 first request"; probe "$name" "$p" "2 repeat"
    stop_dev; start_dev "$name" || return 1
    probe "$name" "$p" "3 after restart"; probe "$name" "$p" "4 repeat"
    stop_dev
  done
}
echo "== before (cache interception off)"; run_variant before false
echo "== after (cache interception on)"; run_variant after true
rm -f .dev.vars .env.local
