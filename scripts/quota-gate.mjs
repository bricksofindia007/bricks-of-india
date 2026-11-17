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
//
// Unreadable egress (scripts/lib/quota-unreadable.mjs): a figure under 24 h old
// is used instead; otherwise fail closed as before. At most one unreadable
// notice per IST day. A blocked video generation run always sends the
// no-video-today notice with the reason. The small state file (last figure,
// notice day) lives at QUOTA_STATE_FILE; the workflow restores it from cache.

import { appendFileSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createClient } from '@supabase/supabase-js';
import { readUsage, mayUpload, mayWriteNonEssential, mayReadNonEssential } from './lib/quota-guard.mjs';
import {
  resolveEgress, takeUnreadableNotice, unreadableNotice, noVideoTodayNotice, isVideoGeneration,
} from './lib/quota-unreadable.mjs';
import { sendAlert } from './lib/alert.mjs';

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const job = arg('--job') ?? 'unknown-job';
const needs = (arg('--needs') ?? 'read').split(',').map((s) => s.trim()).filter(Boolean);
const clean = (v) => (v ?? '').replace(/^﻿/, '').trim();
const STATE_FILE = process.env.QUOTA_STATE_FILE || '.quota-state/state.json';

function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function saveState(state) {
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (e) {
    // A lost state file only means the notice may repeat or the last figure is missing: fail closed, not wrong.
    console.error('[quota-gate] state not saved:', e?.message ?? e);
  }
}

function output(proceed, why = '') {
  const f = process.env.GITHUB_OUTPUT;
  if (f) appendFileSync(f, `proceed=${proceed}\n`);
  console.log(`[quota-gate] ${job}: proceed=${proceed}`);
  // P12 (d): a paused run still ends green, so put the reason on the run
  // summary page as an annotation instead of only in the step log.
  if (!proceed) console.log(`::warning title=Quota gate paused ${job}::${why || 'see gate log'}`);
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
  const now = new Date();
  let state = loadState();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  let live;
  if (!url || !key) {
    live = { ok: false, storageMb: null, dbMb: null, egressProjectedGb: null, simulated: false, error: 'Supabase env not set' };
  } else {
    live = await readUsage(createClient(url, key));
  }

  // Egress: a live reading wins; an unreadable one uses the last figure if under 24 h old.
  const resolved = resolveEgress(live.egressProjectedGb, state, now);
  state = resolved.nextState;
  const usage = { ...live, egressProjectedGb: resolved.egressProjectedGb };
  if (resolved.source === 'last-known') usage.error = `${live.error ?? 'egress estimate unavailable'}; using last figure`;

  if (resolved.liveUnreadable) {
    const n = takeUnreadableNotice(state, now);
    state = n.nextState;
    if (n.send) {
      const lastAtIso = state.lastEgress?.at;
      const note = unreadableNotice({
        now,
        sinceIso: resolved.sinceIso,
        resolved: { ...resolved, lastAtIso, ageHours: resolved.ageHours ?? 0 },
      });
      await sendAlert(note.subject, note.body).catch((e) => console.error('[quota-gate] alert send failed:', e?.message ?? e));
    }
  }

  const fns = { upload: mayUpload, write: mayWriteNonEssential, read: mayReadNonEssential };
  const decisions = needs.filter((n) => fns[n]).map((n) => [n, fns[n](usage)]);
  const tag = usage.simulated ? ' [SIMULATED READING]' : '';
  console.log(`[quota-gate] ${job} needs ${needs.join(',')}: storage=${usage.storageMb} MB db=${usage.dbMb} MB egress_projected=${Number.isFinite(usage.egressProjectedGb) ? usage.egressProjectedGb.toFixed(2) : usage.egressProjectedGb} GB (egress source: ${resolved.source})${tag}`);
  for (const [n, d] of decisions) console.log(`[quota-gate]   ${n}: ${d.allowed ? 'OK' : 'CLOSED'} (${d.level}) ${d.detail}`);

  const blocked = decisions.filter(([, d]) => !d.allowed);
  saveState(state);
  if (blocked.length === 0) return output(true);

  const uploadBlocked = blocked.some(([n]) => n === 'upload');
  const cleanup = uploadBlocked ? await dispatchCleanup() : null;
  const lines = blocked.map(([n, d]) => `- ${n}: ${d.detail}${d.reason === 'usage-unreadable' ? ` (${usage.error})` : ''}`).join('\n');

  if (isVideoGeneration(job)) {
    // Rule (c): a blocked generation run is never silent. Say there is no video today, and why.
    const note = noVideoTodayNotice({ job, now, reasonLines: lines.replace(/\n/g, '; ') });
    await sendAlert(note.subject, note.body + (cleanup ? `\nStorage cleanup: ${cleanup}.` : '')).catch((e) => console.error('[quota-gate] alert send failed:', e?.message ?? e));
  } else {
    await sendAlert(
      `🚨 BOI quota guard paused ${job}${tag}`,
      `${job} did not run: a Free-plan quota guard is closed (FP6.4).\n${lines}\n` +
      (cleanup ? `\nStorage upload guard closed: ${cleanup}.\n` : '') +
      `\nNon-essential jobs pause at these lines; essential paths (scrapers, price writes, page renders, health check, retention and storage cleanup) keep running. The Free-plan grace period is used up, so going over restricts the project immediately.` +
      (usage.simulated ? '\n\nThis reading is SIMULATED (BOI_QUOTA_SIMULATE) -- a proof run, not a real breach.' : ''),
    ).catch((e) => console.error('[quota-gate] alert send failed:', e?.message ?? e));
  }
  if (cleanup) console.log(`[quota-gate] ${cleanup}`);
  return output(false, blocked.map(([n, d]) => `${n}: ${d.detail}`).join('; '));
}

main().catch(async (e) => {
  // P12 (d): this path used to fail closed with no alert -- a silent skip.
  const msg = e?.message ?? String(e);
  console.error('[quota-gate] gate crashed -> fail closed:', msg);
  await sendAlert(
    `🚨 BOI quota gate crashed, paused ${job}`,
    `${job} did not run: the FP6.4 quota gate crashed and failed closed.\nError: ${msg}`,
  ).catch((err) => console.error('[quota-gate] alert send failed:', err?.message ?? err));
  output(false, `gate crashed: ${msg}`);
});
