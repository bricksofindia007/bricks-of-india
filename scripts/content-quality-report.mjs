/**
 * Content Quality Report — daily email digest of content_quality_issues.
 * Queries issues from the last 24h and sends via Resend to BRIEF_EMAIL.
 * Always sends even when clean (confirms the check ran).
 *
 * Run: node --env-file=.env.local scripts/content-quality-report.mjs
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY   = (process.env.RESEND_API_KEY ?? '').replace(/^﻿/, '').trim();
const BRIEF_EMAIL  = (process.env.BRIEF_EMAIL ?? '').replace(/^﻿/, '').trim();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Fetch last 24h issues ─────────────────────────────────────────────────────

const since = new Date(Date.now() - 24 * 3_600_000).toISOString();

const { data: allIssues, error } = await sb
  .from('content_quality_issues')
  .select('*')
  .gte('checked_at', since)
  .eq('resolved', false)
  .order('severity', { ascending: true })  // critical first (alphabetically c < i < w)
  .order('checked_at', { ascending: false });

if (error) {
  console.error('Failed to fetch issues:', error.message);
  process.exit(1);
}

const issues    = allIssues ?? [];
const critical  = issues.filter(i => i.severity === 'critical');
const warnings  = issues.filter(i => i.severity === 'warning');
const info      = issues.filter(i => i.severity === 'info');

const today     = new Date().toISOString().slice(0, 10);
const isClean   = issues.length === 0;
const status    = isClean ? '✅ ALL CLEAR' : `❌ ${critical.length} CRITICAL · ⚠️ ${warnings.length} WARNINGS`;

console.log(`Content Quality Report — ${today}`);
console.log(`Status: ${status}`);
console.log(`Issues in last 24h: ${issues.length} (${critical.length} critical, ${warnings.length} warnings, ${info.length} info)`);

// ── HTML email builder ────────────────────────────────────────────────────────

const SAFFRON = '#F7A800';
const NAVY    = '#0F2D6B';
const RED     = '#dc2626';
const AMBER   = '#d97706';
const SLATE   = '#64748b';

function esc(str) {
  return (str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function severityColor(sev) {
  if (sev === 'critical') return RED;
  if (sev === 'warning')  return AMBER;
  return SLATE;
}

function severityBadge(sev) {
  const color = severityColor(sev);
  const label = sev.toUpperCase();
  return `<span style="background:${color};color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;font-family:monospace;">${label}</span>`;
}

function issueRows(list, maxRows = 30) {
  if (list.length === 0) return '<tr><td colspan="4" style="color:#64748b;padding:8px 0;">No issues</td></tr>';
  return list.slice(0, maxRows).map(iss => `
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:8px 6px;font-size:12px;color:#374151;">${severityBadge(iss.severity)}</td>
      <td style="padding:8px 6px;font-size:12px;color:#374151;font-family:monospace;">${esc(iss.article_slug ?? '—')}</td>
      <td style="padding:8px 6px;font-size:12px;color:#374151;">${esc(iss.section ?? '—')}</td>
      <td style="padding:8px 6px;font-size:12px;color:#374151;">${esc(iss.check_name ?? '—')}: ${esc(iss.detail ?? '')}</td>
    </tr>`).join('');
}

// Group by check_name for summary
const checkCounts = {};
for (const iss of issues) {
  checkCounts[iss.check_name] = (checkCounts[iss.check_name] ?? 0) + 1;
}
const topChecks = Object.entries(checkCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8);

const summaryRows = topChecks.map(([name, count]) =>
  `<tr><td style="padding:4px 8px;font-family:monospace;font-size:12px;">${esc(name)}</td><td style="padding:4px 8px;font-size:12px;text-align:right;">${count}</td></tr>`
).join('');

const headerBg   = isClean ? '#166534' : critical.length > 0 ? RED : AMBER;
const headerText = isClean ? 'ALL CLEAR — Content Quality Check Passed' : `${issues.length} Issues Found`;

const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Inter,sans-serif;background:#f8fafc;">
<div style="max-width:700px;margin:24px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

  <!-- Header -->
  <div style="background:${NAVY};padding:20px 24px;display:flex;align-items:center;gap:12px;">
    <span style="font-family:'Fredoka One',sans-serif;font-size:22px;color:${SAFFRON};font-weight:700;">Bricks of India</span>
    <span style="color:#94a3b8;font-size:14px;">· Content Quality Monitor</span>
  </div>

  <!-- Status banner -->
  <div style="background:${headerBg};padding:16px 24px;">
    <div style="color:#fff;font-size:18px;font-weight:700;">${headerText}</div>
    <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px;">${today} · Issues from last 24 hours</div>
  </div>

  <!-- Score summary -->
  <div style="padding:20px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="text-align:center;padding:8px;">
          <div style="font-size:28px;font-weight:800;color:${RED};">${critical.length}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Critical</div>
        </td>
        <td style="text-align:center;padding:8px;">
          <div style="font-size:28px;font-weight:800;color:${AMBER};">${warnings.length}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Warnings</div>
        </td>
        <td style="text-align:center;padding:8px;">
          <div style="font-size:28px;font-weight:800;color:${SLATE};">${info.length}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Info</div>
        </td>
        <td style="text-align:center;padding:8px;">
          <div style="font-size:28px;font-weight:800;color:${NAVY};">${issues.length}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Total</div>
        </td>
      </tr>
    </table>
  </div>

  ${topChecks.length > 0 ? `
  <!-- Top failing checks -->
  <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
    <div style="font-size:14px;font-weight:600;color:${NAVY};margin-bottom:10px;">Top Failing Checks</div>
    <table style="border-collapse:collapse;width:100%;">
      <thead>
        <tr style="border-bottom:2px solid #e2e8f0;">
          <th style="text-align:left;padding:4px 8px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Check</th>
          <th style="text-align:right;padding:4px 8px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Count</th>
        </tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </div>` : ''}

  ${critical.length > 0 ? `
  <!-- Critical issues -->
  <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
    <div style="font-size:14px;font-weight:600;color:${RED};margin-bottom:10px;">❌ Critical Issues (${critical.length})</div>
    <table style="border-collapse:collapse;width:100%;font-size:12px;">
      <thead>
        <tr style="border-bottom:2px solid #e2e8f0;">
          <th style="text-align:left;padding:6px;color:#64748b;">Sev</th>
          <th style="text-align:left;padding:6px;color:#64748b;">Slug</th>
          <th style="text-align:left;padding:6px;color:#64748b;">Section</th>
          <th style="text-align:left;padding:6px;color:#64748b;">Detail</th>
        </tr>
      </thead>
      <tbody>${issueRows(critical, 20)}</tbody>
    </table>
  </div>` : ''}

  ${warnings.length > 0 ? `
  <!-- Warnings -->
  <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
    <div style="font-size:14px;font-weight:600;color:${AMBER};margin-bottom:10px;">⚠️ Warnings (${warnings.length})</div>
    <table style="border-collapse:collapse;width:100%;font-size:12px;">
      <thead>
        <tr style="border-bottom:2px solid #e2e8f0;">
          <th style="text-align:left;padding:6px;color:#64748b;">Sev</th>
          <th style="text-align:left;padding:6px;color:#64748b;">Slug</th>
          <th style="text-align:left;padding:6px;color:#64748b;">Section</th>
          <th style="text-align:left;padding:6px;color:#64748b;">Detail</th>
        </tr>
      </thead>
      <tbody>${issueRows(warnings, 20)}</tbody>
    </table>
  </div>` : ''}

  ${isClean ? `
  <!-- Clean state -->
  <div style="padding:32px 24px;text-align:center;">
    <div style="font-size:48px;margin-bottom:12px;">✅</div>
    <div style="font-size:18px;font-weight:700;color:#166534;">All content quality checks passed</div>
    <div style="font-size:13px;color:#64748b;margin-top:6px;">No issues found in the last 24 hours</div>
  </div>` : ''}

  <!-- Footer -->
  <div style="background:#f1f5f9;padding:14px 24px;border-top:1px solid #e2e8f0;">
    <div style="font-size:11px;color:#94a3b8;text-align:center;">
      Bricks of India · Content Quality Monitor · ${today}<br>
      This is a detect-only system. No content was auto-modified.
    </div>
  </div>

</div>
</body>
</html>`;

// ── Send via Resend ───────────────────────────────────────────────────────────

if (!RESEND_KEY || !BRIEF_EMAIL) {
  console.warn('No RESEND_API_KEY or BRIEF_EMAIL — report not sent');
  console.log('\n── HTML preview (first 500 chars) ─────────────────────');
  console.log(html.slice(0, 500));
  process.exit(0);
}

const subject = isClean
  ? `✅ Content Quality Clear — ${today}`
  : `❌ ${critical.length} Critical · ⚠️ ${warnings.length} Warnings — BOI Content Quality ${today}`;

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${RESEND_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from:    'Bricks of India <abhinav@bricksofindia.com>',
    to:      [BRIEF_EMAIL],
    subject,
    html,
  }),
});

if (res.ok) {
  const body = await res.json();
  console.log(`Report emailed — Resend ID: ${body.id}`);
} else {
  const body = await res.text();
  console.error('Resend failed:', body);
  process.exit(1);
}

console.log('── Report done ─────────────────────────────────────────');
