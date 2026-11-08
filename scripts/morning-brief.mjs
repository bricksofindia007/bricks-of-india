/**
 * BRIEF-01 — Daily morning brief email
 * Schedule: 01:30 UTC (07:00 IST) via .github/workflows/brief.yml
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

// ── Section 1: Health score (hardcoded — TODO: automate from DB) ──────────────

const HEALTH_SCORE = 85; // TODO: automate from DB

// ── Section 2: Pipeline status ───────────────────────────────────────────────

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

// ── Section 5: Next hard deadline ────────────────────────────────────────────

undefined

// The dates come from config/brief-deadlines.json (order 1430 item 7). Passed dates are dropped by nextDeadlineFrom.
const DEADLINES = loadDeadlines(new URL('../config/brief-deadlines.json', import.meta.url));

function nextDeadline() {
  return nextDeadlineFrom(DEADLINES, Date.now());
}

// ── Section 6: Sign-off ───────────────────────────────────────────────────────

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

function buildHtml({ pipelines, freshness, pending, deadline, today, knownIssues }) {
  const scoreColor = HEALTH_SCORE >= 80 ? GREEN : HEALTH_SCORE >= 60 ? AMBER : RED;

  const s1 = card('1 &mdash; Health Score', `
    <p style="margin:0;font-size:40px;font-weight:bold;color:${scoreColor};line-height:1.1;">
      ${HEALTH_SCORE}<span style="font-size:18px;color:#888;">/100</span>
    </p>
    <p style="margin:4px 0 0;font-size:11px;color:#AAA;"><!-- TODO: automate from DB --></p>
  `);

  const pipeRows = pipelines.map(p => {
    const ok = p.status === 'success';
    const time = p.lastRun
      ? new Date(p.lastRun).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })
      : '—';
    const statusLabel = p.status === 'success' ? 'PASS'
      : p.status === 'failure' ? 'FAIL'
      : p.status.toUpperCase();
    return `<tr>
      <td style="padding:5px 0;font-size:13px;color:${NAVY};">${dot(ok)}${p.label}</td>
      <td style="padding:5px 0 5px 16px;font-size:12px;color:#777;text-align:right;">${time}</td>
      <td style="padding:5px 0 5px 10px;font-size:11px;font-weight:bold;
                 color:${ok ? GREEN : p.status === 'failure' ? RED : AMBER};
                 text-align:right;white-space:nowrap;">${statusLabel}</td>
    </tr>`;
  }).join('');
  const s2 = card('2 &mdash; Pipeline Status',
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
  const s3 = card('3 &mdash; Content Freshness',
    `<table width="100%" cellpadding="0" cellspacing="0">${freshRows}</table>`);

  const approvedColor = pending.approved > 50 ? RED : pending.approved > 20 ? AMBER : GREEN;
  const draftColor    = pending.draft > 20 ? AMBER : GREEN;
  const s4 = card('4 &mdash; Pending Operator Actions', `
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

  let s5;
  if (!deadline) {
    s5 = card('5 &mdash; Next Hard Deadline',
      `<p style="margin:0;font-size:13px;color:#888;">No upcoming deadlines.</p>`);
  } else {
    const d = Math.ceil(deadline.daysLeft);
    const dColor = d <= 7 ? RED : d <= 30 ? AMBER : GREEN;
    s5 = card('5 &mdash; Next Hard Deadline', `
      <p style="margin:0;font-size:20px;font-weight:bold;color:${dColor};">${deadline.label}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#666;">
        ${deadline.date} &mdash; <strong style="color:${dColor};">${d} day${d === 1 ? '' : 's'}</strong> remaining
      </p>
    `);
  }

  const s6 = card('6 &mdash; Daily Dispatch', `
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
          <tr><td style="padding:5px 0;font-size:13px;color:${NAVY};">${r.id}: ${r.issue}</td>
              <td style="padding:5px 0 5px 12px;font-size:12px;color:#666;text-align:right;white-space:nowrap;">${r.state}, fix ${r.fixPr}</td></tr>`).join('')}
        </table>`;
  const s7 = card('7 &mdash; Known issues', issueList);

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
          ${s1}${s2}${s3}${s4}${s5}${s6}${s7}
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

const [pipelines, freshness, pending] = await Promise.all([
  fetchPipelineStatus(),
  fetchFreshness(),
  fetchPending(),
]);

const deadline = nextDeadline();

console.log('Pipelines:', pipelines.map(p => `${p.label}=${p.status}`).join(', '));
console.log('Freshness:', freshness.map(f => `${f.label}=${f.days != null ? f.days.toFixed(1) + 'd' : 'err'}`).join(', '));
console.log(`Pending: approved=${pending.approved} draft=${pending.draft} waiting>${WAITING_DAYS}d=${pending.waitingOver14}`);
console.log('Next deadline:', deadline ? `${deadline.label} in ${Math.ceil(deadline.daysLeft)}d` : 'none');

const knownIssues = loadKnownIssues();
const html = buildHtml({ pipelines, freshness, pending, deadline, today, knownIssues });

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
