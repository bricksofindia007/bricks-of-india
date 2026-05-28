/**
 * BOI Content Quality Report v2
 * Queries content_quality_issues and content_fix_log for last 24h.
 * Sends HTML email digest via Resend to BRIEF_EMAIL.
 * Always sends — clean run confirms the system is working.
 *
 * Usage: node --env-file=.env.local scripts/content-quality-report.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
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
const RESEND_KEY   = process.env.RESEND_API_KEY;
const TO_EMAIL     = process.env.BRIEF_EMAIL;
const SITE_URL     = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bricksofindia.com').replace(/\/$/, '');

if (!SUPABASE_URL || !SERVICE_KEY || !RESEND_KEY || !TO_EMAIL) {
  console.error('Missing env vars (SUPABASE, RESEND_API_KEY, BRIEF_EMAIL)');
  process.exit(1);
}

const sb     = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const resend = new Resend(RESEND_KEY);

const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const dateStr  = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// ── Query data ────────────────────────────────────────────────────────────────

const [{ data: todayIssues }, { data: fixLog }, { data: imageIssues }, { data: allOpen }] = await Promise.all([
  sb.from('content_quality_issues').select('*').gte('checked_at', since24h).eq('resolved', false),
  sb.from('content_fix_log').select('*').gte('fixed_at', since24h),
  sb.from('content_image_registry').select('*').gte('checked_at', since24h),
  sb.from('content_quality_issues').select('id, severity').eq('resolved', false),
]);

const newIssues  = todayIssues ?? [];
const fixes      = fixLog      ?? [];
const imgReg     = imageIssues ?? [];
const openIssues = allOpen     ?? [];

const bySeverity = { critical: 0, warning: 0, info: 0 };
for (const i of newIssues) bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;

const totalOpen = { critical: 0, warning: 0, info: 0 };
for (const i of openIssues) totalOpen[i.severity] = (totalOpen[i.severity] || 0) + 1;

const isClean = newIssues.length === 0;
const subject = isClean
  ? `BOI Content Quality — All clear ✅ ${dateStr}`
  : `BOI Content Quality — ${bySeverity.critical} critical, ${bySeverity.warning} warnings ${dateStr}`;

// ── Image health stats ────────────────────────────────────────────────────────

const imgBroken      = imgReg.filter(r => r.http_status !== 200 && r.http_status !== null).length;
const imgPlaceholder = imgReg.filter(r => /placeholder|default|no-image|fallback|blank/i.test(r.image_url ?? '')).length;
const imgDuplicate   = imgReg.filter(r => r.is_duplicate).length;
const imgTotal       = new Set(imgReg.map(r => r.image_url).filter(Boolean)).size;
const imgHealthy     = imgBroken === 0 && imgPlaceholder === 0;

// ── HTML builders ─────────────────────────────────────────────────────────────

const SAFFRON = '#F7A800';
const NAVY    = '#0F2D6B';
const RED     = '#DC2626';
const AMBER   = '#D97706';
const GREEN   = '#16A34A';
const GRAY    = '#6B7280';

function sectionHeader(title, count, color = SAFFRON) {
  return `<tr><td style="padding:20px 24px 8px;background:#fff;">
    <h2 style="margin:0;font-size:15px;font-weight:700;color:${color};letter-spacing:0.5px;text-transform:uppercase;border-bottom:2px solid ${color};padding-bottom:6px;">
      ${title}${count !== undefined ? ` <span style="font-weight:400;font-size:13px;color:${GRAY};">(${count})</span>` : ''}
    </h2></td></tr>`;
}

function issueRow(slug, checkName, detail, section) {
  const path = { news_articles: 'news', blog_posts: 'opinion', reviews: 'reviews', guides: 'guides' }[section] ?? 'news';
  const url  = `${SITE_URL}/${path}/${slug}`;
  return `<tr><td style="padding:4px 24px;border-bottom:1px solid #f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:12px;color:${NAVY};"><a href="${url}" style="color:${NAVY};text-decoration:none;font-weight:600;">${slug.slice(0, 55)}</a></td>
      <td style="font-size:11px;color:${GRAY};text-align:right;white-space:nowrap;">${checkName}</td>
    </tr><tr><td colspan="2" style="font-size:11px;color:${GRAY};padding-top:2px;">${(detail ?? '').slice(0, 120)}</td></tr>
    </table></td></tr>`;
}

function fixRow(f) {
  return `<tr><td style="padding:4px 24px;border-bottom:1px solid #f3f4f6;font-size:12px;color:${NAVY};">
    <strong>${f.article_slug?.slice(0, 45) ?? '?'}</strong>
    <span style="color:${GRAY};"> → ${f.fix_type}</span>
  </td></tr>`;
}

function stat(label, value, color = NAVY) {
  return `<tr><td style="padding:3px 24px;font-size:12px;color:${GRAY};">${label}</td>
          <td style="padding:3px 24px;font-size:12px;font-weight:600;color:${color};text-align:right;">${value}</td></tr>`;
}

// ── Build email ───────────────────────────────────────────────────────────────

const criticals = newIssues.filter(i => i.severity === 'critical');
const warnings  = newIssues.filter(i => i.severity === 'warning');
const infos     = newIssues.filter(i => i.severity === 'info');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

<!-- HEADER -->
<tr><td style="background:${NAVY};padding:24px;text-align:center;">
  <p style="margin:0;color:#fff;font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:0.7;">Bricks of India</p>
  <h1 style="margin:8px 0 4px;color:#fff;font-size:20px;font-weight:700;">Content Quality Report</h1>
  <p style="margin:0;color:${SAFFRON};font-size:13px;">${dateStr}</p>
</td></tr>

<!-- STATUS BANNER -->
<tr><td style="padding:16px 24px;background:${isClean ? '#f0fdf4' : '#fef2f2'};border-bottom:1px solid #e5e7eb;">
  <p style="margin:0;font-size:14px;font-weight:600;color:${isClean ? GREEN : RED};">
    ${isClean ? '✅ All clear — no new issues today' : `❌ ${bySeverity.critical} critical · ⚠️ ${bySeverity.warning} warnings · ℹ️ ${bySeverity.info} info`}
  </p>
</td></tr>

<!-- SECTION 1: AUTO-FIXES -->
${sectionHeader('Fixed Automatically', fixes.length, GREEN)}
<tr><td style="padding:0 0 8px;">
${fixes.length > 0
  ? `<table width="100%" cellpadding="0" cellspacing="0">${fixes.map(fixRow).join('')}</table>`
  : `<p style="padding:8px 24px;font-size:12px;color:${GRAY};margin:0;">No auto-fixes applied today</p>`}
</td></tr>

<!-- SECTION 2: CRITICAL -->
${sectionHeader('Critical — Fix Today', criticals.length, RED)}
<tr><td style="padding:0 0 8px;">
${criticals.length > 0
  ? `<table width="100%" cellpadding="0" cellspacing="0">${criticals.map(i => issueRow(i.article_slug, i.check_name, i.detail, i.section)).join('')}</table>`
  : `<p style="padding:8px 24px;font-size:12px;color:${GREEN};margin:0;">✓ No critical issues</p>`}
</td></tr>

<!-- SECTION 3: WARNINGS -->
${sectionHeader('Warnings — Fix This Week', warnings.length, AMBER)}
<tr><td style="padding:0 0 8px;">
${warnings.length > 0
  ? `<table width="100%" cellpadding="0" cellspacing="0">${warnings.map(i => issueRow(i.article_slug, i.check_name, i.detail, i.section)).join('')}</table>`
  : `<p style="padding:8px 24px;font-size:12px;color:${GREEN};margin:0;">✓ No warnings</p>`}
</td></tr>

<!-- SECTION 4: INFO -->
${infos.length > 0 ? `
${sectionHeader('Info — Fix When Time Allows', infos.length, GRAY)}
<tr><td style="padding:0 0 8px;">
<table width="100%" cellpadding="0" cellspacing="0">${infos.map(i => issueRow(i.article_slug, i.check_name, i.detail, i.section)).join('')}</table>
</td></tr>` : ''}

<!-- SECTION 5: IMAGE HEALTH -->
${sectionHeader('Image Health', undefined, SAFFRON)}
<tr><td style="padding:8px 0;">
<table width="100%" cellpadding="0" cellspacing="0">
  ${stat('Total unique images checked', imgTotal)}
  ${stat('Broken (non-200)', imgBroken, imgBroken > 0 ? RED : GREEN)}
  ${stat('Placeholder URLs', imgPlaceholder, imgPlaceholder > 0 ? RED : GREEN)}
  ${stat('Duplicate images', imgDuplicate, imgDuplicate > 0 ? AMBER : GREEN)}
  ${stat('Overall', imgHealthy ? '✅ All healthy' : '❌ Issues found', imgHealthy ? GREEN : RED)}
</table>
</td></tr>

<!-- SECTION 6: STATS -->
${sectionHeader('System Stats', undefined, GRAY)}
<tr><td style="padding:8px 0 16px;">
<table width="100%" cellpadding="0" cellspacing="0">
  ${stat('New issues today', newIssues.length)}
  ${stat('Auto-fixes applied', fixes.length, GREEN)}
  ${stat('Total open (all time)', openIssues.length)}
  ${stat('Critical open', totalOpen.critical, totalOpen.critical > 0 ? RED : GREEN)}
  ${stat('Warning open', totalOpen.warning, totalOpen.warning > 0 ? AMBER : GREEN)}
  ${stat('System ran', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST')}
</table>
</td></tr>

<!-- FOOTER -->
<tr><td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0;font-size:11px;color:${GRAY};">
    <a href="${SITE_URL}/admin/pending" style="color:${NAVY};">Admin Panel</a> ·
    <a href="${SITE_URL}/news" style="color:${NAVY};">News</a> ·
    <a href="${SITE_URL}/guides" style="color:${NAVY};">Guides</a>
  </p>
  <p style="margin:6px 0 0;font-size:10px;color:#9CA3AF;">Bricks of India Content Quality System</p>
</td></tr>

</table></td></tr></table></body></html>`;

// ── Send ──────────────────────────────────────────────────────────────────────

const { data: sendData, error: sendErr } = await resend.emails.send({
  from:    'Bricks of India <abhinav@bricksofindia.com>',
  to:      [TO_EMAIL],
  subject,
  html,
});

if (sendErr) {
  console.error('Resend error:', sendErr.message);
  process.exit(1);
}

console.log(`Report sent: ${sendData?.id}`);
console.log(`Subject: ${subject}`);
console.log(`New issues: ${newIssues.length} (${bySeverity.critical} critical, ${bySeverity.warning} warnings, ${bySeverity.info} info)`);
console.log(`Auto-fixes applied: ${fixes.length}`);
console.log(`Total open: ${openIssues.length}`);
