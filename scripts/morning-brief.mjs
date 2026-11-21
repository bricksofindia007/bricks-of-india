/**
 * BRIEF-01 — Daily morning brief email
 * Schedule: 01:30 UTC (07:00 IST) via .github/workflows/brief.yml
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { waitingCutoffIso, knownIssueRows, WAITING_DAYS } from './lib/brief-known-issues.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(join(__dirname, '../.env.local'), 'utf-8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
} catch {}

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = (process.env.RESEND_API_KEY    ?? '').replace(/^﻿/, '').trim();
const BRIEF_EMAIL    = (process.env.BRIEF_EMAIL       ?? '').replace(/^﻿/, '').trim();
const GH_TOKEN       = (process.env.GH_DISPATCH_TOKEN ?? '').replace(/^﻿/, '').trim();
const GH_REPO        = 'bricksofindia007/bricks-of-india';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!RESEND_API_KEY || !BRIEF_EMAIL) {
  console.error('Missing RESEND_API_KEY or BRIEF_EMAIL');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const SAFFRON = '#FF9933';
const NAVY    = '#1A237E';
const RED     = '#D32F2F';
const GREEN   = '#2E7D32';
const AMBER   = '#F57C00';

// ── HTML helpers ──────────────────────────────────────────────────────────────

function card(title, body) {
  return `
    <tr><td style="padding:0 0 14px 0;">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#FFFFFF;border-radius:6px;border-left:4px solid ${SAFFRON};">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 10px;font-size:10px;font-weight:bold;color:${SAFFRON};
                    text-transform:uppercase;letter-spacing:1.2px;">${title}</p>
          ${body}
        </td></tr>
      </table>
    </td></tr>`;
}

function dot(ok) {
  const color = ok ? GREEN : RED;
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;
                        background:${color};margin-right:6px;vertical-align:middle;"></span>`;
}

function freshnessColor(days, warn) {
  if (days > warn) return RED;
  if (days > warn * 0.7) return AMBER;
  return GREEN;
}

// ── Section 1: Pipeline output (counted from the database, last 24 h or 7 days) ──
// Each pipeline row shows its run status and what it produced. The batch generator shows its latest run
// (published of attempted), read from generator_runs. A PASS with no output is shown as PASS, 0 OUTPUT.

async function fetchOutputs() {
  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [radar, social, prices, gen] = await Promise.all([
    sb.from("raw_signals").select("*", { count: "exact", head: true }).gte("fetched_at", since24),
    sb.from("posted_sets").select("*", { count: "exact", head: true }).gte("posted_at", since7d),
    sb.from("store_prices").select("*", { count: "exact", head: true }).gte("scraped_at", since24),
    sb.from("generator_runs").select("trigger, started_at, drafts_attempted, drafts_succeeded").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const when = (iso) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" });
  const counted = (res, text) => res.error ? { err: res.error.message } : { text: text(res.count ?? 0), zero: (res.count ?? 0) === 0 };
  let generator;
  if (gen.error) generator = { err: gen.error.message };
  else if (!gen.data) generator = { text: "no generator run recorded", zero: false };
  else {
    const d = gen.data;
    generator = { text: `${d.drafts_succeeded} published of ${d.drafts_attempted} attempted (latest run ${when(d.started_at)}, ${d.trigger})`, zero: d.drafts_attempted > 0 && d.drafts_succeeded === 0 };
  }
  return {
    "radar.yml": counted(radar, (n) => `${n} signals fetched, last 24 h`),
    "social-automation.yml": counted(social, (n) => `${n} sets posted, last 7 days`),
    "scrape-prices.yml": counted(prices, (n) => `${n} price rows scraped, last 24 h`),
    "generate-drafts.yml": generator,
  };
}

// ── Section 1 (cont.): Pipeline list ───────────────────────────────────────────────

const PIPELINES = [
  { file: 'radar.yml',             label: 'RADAR pipeline'    },
  { file: 'social-automation.yml', label: 'Social automation' },
  { file: 'scrape-prices.yml',     label: 'Price scraper'     },
  { file: 'generate-drafts.yml',   label: 'Batch generator'   },
];

async function fetchPipelineStatus() {
  if (!GH_TOKEN) {
    console.warn('GH_DISPATCH_TOKEN not set — pipeline status unavailable');
    return PIPELINES.map(p => ({ ...p, status: 'unknown', lastRun: null }));
  }
  return Promise.all(PIPELINES.map(async p => {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GH_REPO}/actions/workflows/${p.file}/runs?per_page=1`,
        { headers: { Authorization: `Bearer ${GH_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' } }
      );
      if (!res.ok) return { ...p, status: 'api-error', lastRun: null };
      const json = await res.json();
      const run = json.workflow_runs?.[0];
      if (!run) return { ...p, status: 'no-runs', lastRun: null };
      return { ...p, status: run.conclusion ?? run.status, lastRun: run.created_at };
    } catch {
      return { ...p, status: 'error', lastRun: null };
    }
  }));
}

// ── Section 3: Content freshness ─────────────────────────────────────────────

const FRESHNESS_SOURCES = [
  { table: 'news_articles', label: 'News',    warnDays: 7  },
  { table: 'guides',        label: 'Guides',  warnDays: 14 },
  { table: 'reviews',       label: 'Reviews', warnDays: 30 },
];

async function fetchFreshness() {
  return Promise.all(FRESHNESS_SOURCES.map(async src => {
    try {
      const { data, error } = await sb
        .from(src.table)
        .select('published_at')
        .order('published_at', { ascending: false })
        .limit(1)
        .single();
      if (error) return { ...src, days: null, err: error.message };
      const days = (Date.now() - new Date(data.published_at).getTime()) / 86_400_000;
      return { ...src, days };
    } catch (e) {
      return { ...src, days: null, err: e.message };
    }
  }));
}

// ── Section 4: Pending operator actions ──────────────────────────────────────

async function fetchPending() {
  const cutoff = waitingCutoffIso(Date.now(), WAITING_DAYS);
  const [{ count: approved }, { count: draft }, { count: waiting }] = await Promise.all([
    sb.from('pending_drafts').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    sb.from('pending_drafts').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    // Order 1580 (f): drafts waiting more than 14 days (created before the cutoff).
    sb.from('pending_drafts').select('*', { count: 'exact', head: true }).eq('status', 'draft').lt('created_at', cutoff),
  ]);
  return { approved: approved ?? 0, draft: draft ?? 0, waitingOver14: waiting ?? 0 };
}

// Order 1580 (c): the known-issues register (config/known-issues.json). A missing file shows a line, never a crash.
function loadKnownIssues() {
  try {
    return { rows: knownIssueRows(JSON.parse(readFileSync(new URL('../config/known-issues.json', import.meta.url), 'utf8')).issues), error: null };
  } catch (e) {
    return { rows: [], error: e.message };
  }
}

// ── Section 5: Sign-off ───────────────────────────────────────────────────────

const SIGNOFFS = [
  'Chai is ₹20. This LEGO set is ₹49,999. Life is not fair. Build anyway.',
  'Deadlines do not care about your backlog. Neither does your wallet. Ship it.',
  'The catalogue will not curate itself. The articles will not write themselves. Get moving.',
  'Set prices in India are 40% above MRP and people still buy. That is the audience. Respect them.',
  'Budget ke baad bhi LEGO khareedna — that is the Indian AFOL experience. Capture it.',
  '338 approved drafts sitting. Gemini quota sitting. You sitting. Someone has to move.',
];

function todaySignoff() {
  return SIGNOFFS[new Date().getDay() % SIGNOFFS.length];
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml({ pipelines, outputs, freshness, pending, today, knownIssues }) {
  const pipeRows = pipelines.map(p => {
    const out = outputs[p.file] ?? {};
    const ok = p.status === "success";
    const time = p.lastRun
      ? new Date(p.lastRun).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" })
      : "—";
    const statusLabel = ok && out.zero ? "PASS, 0 OUTPUT"
      : ok ? "PASS"
      : p.status === "failure" ? "FAIL"
      : p.status.toUpperCase();
    const statusColor = p.status === "failure" ? RED : ok && !out.zero ? GREEN : AMBER;
    const outLine = out.err ? `output unavailable: ${out.err}` : (out.text ?? "");
    return `<tr>
      <td style="padding:5px 0;font-size:13px;color:${NAVY};">${dot(ok && !out.zero)}${p.label}
        <div style="font-size:11px;color:#777;margin-top:2px;">${outLine}</div></td>
      <td style="padding:5px 0 5px 16px;font-size:12px;color:#777;text-align:right;vertical-align:top;">${time}</td>
      <td style="padding:5px 0 5px 10px;font-size:11px;font-weight:bold;color:${statusColor};text-align:right;white-space:nowrap;vertical-align:top;">${statusLabel}</td>
    </tr>`;
  }).join("");
  const s2 = card("1 &mdash; Pipeline Status and Output",
    `<table width="100%" cellpadding="0" cellspacing="0">${pipeRows}</table>`);

  const freshRows = freshness.map(f => {
    if (f.err || f.days === null) {
      return `<tr>
        <td style="padding:5px 0;font-size:13px;color:${NAVY};">${f.label}</td>
        <td style="padding:5px 0 5px 16px;font-size:12px;color:${RED};text-align:right;">
          error &mdash; ${f.err ?? 'no data'}</td>
      </tr>`;
    }
    const d = Math.floor(f.days);
    const color = freshnessColor(f.days, f.warnDays);
    const flag = f.days > f.warnDays ? ' &#9888;&#65039;' : '';
    return `<tr>
      <td style="padding:5px 0;font-size:13px;color:${NAVY};">${f.label}</td>
      <td style="padding:5px 0 5px 16px;font-size:13px;font-weight:bold;
                 color:${color};text-align:right;">${d}d ago${flag}</td>
    </tr>`;
  }).join('');
  const s3 = card('2 &mdash; Content Freshness',
    `<table width="100%" cellpadding="0" cellspacing="0">${freshRows}</table>`);

  const approvedColor = pending.approved > 50 ? RED : pending.approved > 20 ? AMBER : GREEN;
  const draftColor    = pending.draft > 20 ? AMBER : GREEN;
  const s4 = card('3 &mdash; Pending Operator Actions', `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:5px 0;font-size:13px;color:${NAVY};">Awaiting generation</td>
        <td style="padding:5px 0 5px 16px;font-size:20px;font-weight:bold;
                   color:${approvedColor};text-align:right;">${pending.approved}</td>
      </tr>
      <tr>
        <td style="padding:5px 0;font-size:13px;color:${NAVY};">Ready to review + publish</td>
        <td style="padding:5px 0 5px 16px;font-size:20px;font-weight:bold;
                   color:${draftColor};text-align:right;">${pending.draft}</td>
      </tr>
      <tr>
        <td style="padding:5px 0;font-size:13px;color:${NAVY};">Waiting more than ${WAITING_DAYS} days</td>
        <td style="padding:5px 0 5px 16px;font-size:20px;font-weight:bold;
                   color:${pending.waitingOver14 > 0 ? AMBER : NAVY};text-align:right;">${pending.waitingOver14}</td>
      </tr>
    </table>
  `);

  const s5 = card('4 &mdash; Daily Dispatch', `
    <p style="margin:0;font-size:14px;color:${NAVY};font-style:italic;line-height:1.5;">
      &ldquo;${todaySignoff()}&rdquo;
    </p>
  `);

  // Order 1580 (c): known issues appear here once, not in email (alert standard section 3).
  const issueList = knownIssues.error
    ? `<p style="margin:0;font-size:13px;color:#888;">Register unavailable: ${knownIssues.error}</p>`
    : knownIssues.rows.length === 0
      ? '<p style="margin:0;font-size:13px;color:#888;">No open known issues.</p>'
      : `<table width="100%" cellpadding="0" cellspacing="0">${knownIssues.rows.map(r => `
          <tr><td style="padding:5px 0;font-size:13px;color:${NAVY};">${r.id}</td>
              <td style="padding:5px 0 5px 12px;font-size:12px;color:#666;text-align:right;white-space:nowrap;">${r.state}</td></tr>`).join('')}
        </table>`;
  const s6 = card('6 &mdash; Known issues', issueList);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>BOI Morning Brief</title>
</head>
<body style="margin:0;padding:0;background:#EBEBEB;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EBEBEB;">
  <tr><td align="center" style="padding:24px 12px;">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;">
      <tr><td style="background:${NAVY};border-radius:8px 8px 0 0;padding:22px 26px;">
        <p style="margin:0;font-size:22px;font-weight:bold;color:${SAFFRON};">&#129521; Bricks of India</p>
        <p style="margin:5px 0 0;font-size:13px;color:#FFFFFF;opacity:0.75;">
          Morning Brief &mdash; ${today}</p>
      </td></tr>
      <tr><td style="background:#EBEBEB;padding:14px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${s1}${s2}${s3}${s4}${s5}${s6}
        </table>
      </td></tr>
      <tr><td style="background:#FFFFFF;border-radius:0 0 8px 8px;padding:14px 26px;
                     border-top:1px solid #DDDDDD;">
        <p style="margin:0;font-size:11px;color:#AAAAAA;text-align:center;">
          Bricks of India &bull; bricksofindia.com &bull; Auto-sent at 01:30 UTC daily
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const today = new Date().toLocaleDateString('en-IN', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  timeZone: 'Asia/Kolkata',
});

console.log('BRIEF-01: collecting data...');

const [pipelines, freshness, pending, outputs] = await Promise.all([
  fetchPipelineStatus(),
  fetchFreshness(),
  fetchPending(),
  fetchOutputs(),
]);

console.log('Pipelines:', pipelines.map(p => `${p.label}=${p.status} [${outputs[p.file]?.text ?? outputs[p.file]?.err ?? '-'}]`).join(', '));
console.log('Freshness:', freshness.map(f => `${f.label}=${f.days != null ? f.days.toFixed(1) + 'd' : 'err'}`).join(', '));
console.log(`Pending: approved=${pending.approved} draft=${pending.draft} waiting>${WAITING_DAYS}d=${pending.waitingOver14}`);

const knownIssues = loadKnownIssues();
const html = buildHtml({ pipelines, outputs, freshness, pending, today, knownIssues });

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'Bricks of India <abhinav@bricksofindia.com>',
    to: [BRIEF_EMAIL],
    subject: `BOI Morning Brief — ${today}`,
    html,
  }),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`Resend error (${res.status}): ${text}`);
  process.exit(1);
}

const { id } = await res.json();
console.log(`Brief sent. Resend message ID: ${id}`);
