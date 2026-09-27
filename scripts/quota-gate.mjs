#!/usr/bin/env node
// FP6.4 job gate (P4 Step 2). Run by .github/workflows/quota-gate.yml as the
// first job of every NON-essential workflow (classification: PR #, table in
// the FP6.4 PR). Reads usage ONCE (scripts/lib/quota-guard.mjs), answers the
// questions the job needs, and writes `proceed=true|false` to $GITHUB_OUTPUT.
//
//   node scripts/quota-gate.mjs --job radar --needs read,write
//   node scripts/quota-gate.mjs --job vidp4-generate --needs read,write,upload
//
// A closed guard -> proceed=false, alert through Check 11's sender
// (scripts/lib/alert.mjs), and for a closed UPLOAD guard also dispatch the
// #183 storage cleanup (cleanup-published-assets.yml) with this job's
// GITHUB_TOKEN. Usage unreadable -> proceed=false (non-essential jobs fail
// closed). The gate itself always exits 0: a guarded pause is not a failure.

import { appendFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { readUsage, mayUpload, mayWriteNonEssential, mayReadNonEssential } from './lib/quota-guard.mjs';
import { sendAlert } from './lib/alert.mjs';

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const job = arg('--job') ?? 'unknown-job';
const needs = (arg('--needs') ?? 'read').split(',').map((s) => s.trim()).filter(Boolean);
const clean = (v) => (v ?? '').replace(/^﻿/, '').trim();

function output(proceed) {
  const f = process.env.GITHUB_OUTPUT;
  if (f) appendFileSync(f, `proceed=${proceed}\n`);
  console.log(`[quota-gate] ${job}: proceed=${proceed}`);
}

async function dispatchCleanup() {
  const token = clean(process.env.GITHUB_TOKEN);
  const repo = process.env.GITHUB_REPOSITORY || 'bricksofindia007/bricks-of-india';
  if (!token) return 'cleanup NOT dispatched: no GITHUB_TOKEN in this environment';
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/cleanup-published-assets.yml/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ ref: 'main' }),
    });
    return r.status === 204 ? 'cleanup-published-assets.yml dispatched' : `cleanup dispatch FAILED (HTTP ${r.status}: ${(await r.text()).slice(0, 200)})`;
  } catch (e) {
    return `cleanup dispatch FAILED (${e?.message ?? e})`;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  let usage;
  if (!url || !key) {
    usage = { ok: false, storageMb: null, dbMb: null, egressProjectedGb: null, simulated: false, error: 'Supabase env not set' };
  } else {
    usage = await readUsage(createClient(url, key));
  }
  const fns = { upload: mayUpload, write: mayWriteNonEssential, read: mayReadNonEssential };
  const decisions = needs.filter((n) => fns[n]).map((n) => [n, fns[n](usage)]);
  const tag = usage.simulated ? ' [SIMULATED READING]' : '';
  console.log(`[quota-gate] ${job} needs ${needs.join(',')}: storage=${usage.storageMb} MB db=${usage.dbMb} MB egress_projected=${Number.isFinite(usage.egressProjectedGb) ? usage.egressProjectedGb.toFixed(2) : usage.egressProjectedGb} GB${tag}`);
  for (const [n, d] of decisions) console.log(`[quota-gate]   ${n}: ${d.allowed ? 'OK' : 'CLOSED'} (${d.level}) ${d.detail}`);

  const blocked = decisions.filter(([, d]) => !d.allowed);
  if (blocked.length === 0) return output(true);

  const uploadBlocked = blocked.some(([n]) => n === 'upload');
  const cleanup = uploadBlocked ? await dispatchCleanup() : null;
  const lines = blocked.map(([n, d]) => `- ${n}: ${d.detail}${d.reason === 'usage-unreadable' ? ` (${usage.error})` : ''}`).join('\n');
  await sendAlert(
    `🚨 BOI quota guard paused ${job}${tag}`,
    `${job} did not run: a Free-plan quota guard is closed (FP6.4).\n${lines}\n` +
    (cleanup ? `\nStorage upload guard closed: ${cleanup}.\n` : '') +
    `\nNon-essential jobs pause at these lines; essential paths (scrapers, price writes, page renders, health check, retention and storage cleanup) keep running. The Free-plan grace period is used up, so going over restricts the project immediately.` +
    (usage.simulated ? '\n\nThis reading is SIMULATED (BOI_QUOTA_SIMULATE) -- a proof run, not a real breach.' : ''),
  ).catch((e) => console.error('[quota-gate] alert send failed:', e?.message ?? e));
  if (cleanup) console.log(`[quota-gate] ${cleanup}`);
  return output(false);
}

main().catch((e) => {
  console.error('[quota-gate] gate crashed -> fail closed:', e?.message ?? e);
  output(false);
});
