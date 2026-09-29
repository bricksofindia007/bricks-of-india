#!/usr/bin/env node
// P8 item 6 (approved; FP1.4 #242): keep only the CURRENT and PREVIOUS builds' ISR/data caches in R2.
// OpenNext keys every cache object as incremental-cache/<BUILD_ID>/<sha256>.<cache|fetch>, so an old
// build's objects are dead weight once a newer build serves traffic. This rewrites the bucket's
// lifecycle rules:
//   * keeps every rule it doesn't manage (the default multipart-abort rule, the 30-day
//     `incremental-cache-30d` backstop -- P8: "the 30-day rule stays");
//   * adds one rule per OLD build: `prune-<id>`, prefix incremental-cache/<id>/, delete at age 1 day.
// R2 applies lifecycle deletions itself: no per-object API calls.
//
//   CURRENT_BUILD_ID=... MODE=dry-run|apply node scripts/ci/r2-prune-builds.mjs
//
// Failure behaviour (G14): any error exits non-zero but the deploy job runs this with
// continue-on-error, so a failed prune never fails a deploy. The worst case is storage staying where it is.
const CF = 'https://api.cloudflare.com/client/v4';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim(), ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const BUCKET = process.env.R2_BUCKET ?? 'bricksofindia-next-cache';
const CURRENT = (process.env.CURRENT_BUILD_ID ?? '').trim();
const MODE = process.env.MODE ?? 'dry-run';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

export function planRules(existingRules, buildPrefixes, current, previous) {
  const keep = new Set([current, previous].filter(Boolean));
  const unmanaged = (existingRules ?? []).filter((r) => !String(r.id).startsWith('prune-'));
  const prune = buildPrefixes.filter((id) => !keep.has(id)).map((id) => ({
    id: `prune-${id}`, enabled: true, conditions: { prefix: `incremental-cache/${id}/` },
    deleteObjectsTransition: { condition: { type: 'Age', maxAge: 86400 } },
  }));
  return { rules: [...unmanaged, ...prune], kept: [...keep], pruned: prune.map((r) => r.id.slice(6)) };
}

async function api(path, init = {}) {
  const r = await fetch(`${CF}${path}`, { ...init, headers: H });
  const j = await r.json();
  if (!j.success) throw new Error(`${init.method ?? 'GET'} ${path}: ${JSON.stringify(j.errors).slice(0, 300)}`);
  return j;
}

async function newestObjectTime(prefix) {
  // One page (<= 1000 objects) is enough to rank builds by recency.
  const j = await api(`/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects?prefix=${encodeURIComponent(prefix)}&per_page=1000`);
  return Math.max(0, ...j.result.map((o) => Date.parse(o.last_modified)));
}

async function storageNow() {
  const q = `query($a:String!,$b:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a}){r2StorageAdaptiveGroups(limit:1,orderBy:[datetime_DESC],filter:{datetime_geq:$s,datetime_leq:$e,bucketName:$b}){max{payloadSize metadataSize objectCount} dimensions{datetime}}}}}`;
  const r = await fetch(`${CF}/graphql`, { method: 'POST', headers: H, body: JSON.stringify({ query: q, variables: { a: ACCOUNT, b: BUCKET, s: new Date(Date.now() - 2 * 864e5).toISOString(), e: new Date().toISOString() } }) });
  const g = (await r.json()).data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups?.[0];
  return g ? { gb: +((g.max.payloadSize + g.max.metadataSize) / 1e9).toFixed(2), objects: g.max.objectCount, at: g.dimensions.datetime } : null;
}

async function main() {
  if (!TOKEN || !ACCOUNT) throw new Error('CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID missing');
  if (!/^[A-Za-z0-9_-]{8,}$/.test(CURRENT)) throw new Error(`CURRENT_BUILD_ID missing or odd: "${CURRENT}" -- refusing (never prune without knowing the live build)`);
  const top = await api(`/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects?prefix=incremental-cache/&delimiter=/&per_page=1000`);
  const ids = (top.result_info?.delimited ?? []).map((p) => p.replace(/^incremental-cache\//, '').replace(/\/$/, ''));
  if (!ids.includes(CURRENT)) console.log(`note: current build ${CURRENT} has no objects yet (fresh deploy); it is kept regardless`);
  const ranked = [];
  for (const id of ids.filter((x) => x !== CURRENT)) ranked.push({ id, newest: await newestObjectTime(`incremental-cache/${id}/`) });
  ranked.sort((a, b) => b.newest - a.newest);
  const previous = ranked[0]?.id ?? null;
  const lc = await api(`/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/lifecycle`);
  const plan = planRules(lc.result?.rules ?? [], ids, CURRENT, previous);
  const before = await storageNow();
  console.log(JSON.stringify({ mode: MODE, bucket: BUCKET, current: CURRENT, previous, builds: ids.length, kept: plan.kept, prune_rules: plan.pruned.length,
    unmanaged_rules_kept: plan.rules.filter((r) => !String(r.id).startsWith('prune-')).map((r) => r.id), storage_before: before }, null, 1));
  if (MODE !== 'apply') { console.log('dry-run: lifecycle NOT changed'); return; }
  await api(`/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/lifecycle`, { method: 'PUT', body: JSON.stringify({ rules: plan.rules }) });
  const after = await api(`/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/lifecycle`);
  console.log(`applied: ${after.result.rules.length} lifecycle rules now (${after.result.rules.filter((r) => String(r.id).startsWith('prune-')).length} prune-*). Objects expire within ~1 day; storage_after is read by the next census.`);
}

if (process.argv[1]?.endsWith('r2-prune-builds.mjs')) main().catch((e) => { console.error(`r2 prune FAILED (deploy unaffected): ${e.message}`); process.exit(1); });
