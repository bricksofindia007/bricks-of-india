/**
 * BOI Health Check — runs nightly at 02:30 UTC (08:00 IST)
 * Sends one email per failed check via Resend. Silence = green.
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

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Strip BOM (U+FEFF, codepoint 65279) — GitHub Secrets copied from BOM-encoded files include it
const RESEND_API_KEY    = (process.env.RESEND_API_KEY ?? '').replace(/^﻿/, '').trim();
const BRIEF_EMAIL       = (process.env.BRIEF_EMAIL ?? '').replace(/^﻿/, '').trim();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// IG token expiry — hardcoded, refresh date is ~60 days before this
const IG_TOKEN_EXPIRY = new Date('2026-07-23');
const IG_WARN_DAYS    = 14;

const failures = [];

async function sendAlert(subject, body) {
  if (!RESEND_API_KEY || !BRIEF_EMAIL) {
    console.warn(`ALERT (no email config): ${subject}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Bricks of India <abhinav@bricksofindia.com>',
      to: [BRIEF_EMAIL],
      subject,
      html: `<pre style="font-family:monospace;font-size:14px;">${body}</pre>`,
    }),
  });
  if (!res.ok) console.error(`Resend failed (${res.status}): ${await res.text()}`);
}

// ── Check 1: /news freshness (> 7 days = alert) ─────────────────────────────
try {
  const { data, error } = await sb
    .from('news_articles')
    .select('published_at')
    .order('published_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  const ageDays = (Date.now() - new Date(data.published_at).getTime()) / 86_400_000;
  console.log(`[1] /news freshness: last article ${ageDays.toFixed(1)} days ago`);
  if (ageDays > 7) {
    failures.push('news-stale');
    await sendAlert(
      '⚠️ BOI Health Alert — /news stale',
      `Last news article published ${ageDays.toFixed(1)} days ago.\n\nThreshold: 7 days.\n\nCheck /admin/pending for approved drafts waiting to publish.`
    );
  }
} catch (e) {
  console.error('[1] news freshness check failed:', e.message);
  failures.push('news-check-error');
}

// ── Check 2: /blog freshness (> 14 days = alert) ────────────────────────────
try {
  const { data, error } = await sb
    .from('blog_posts')
    .select('published_at')
    .order('published_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  const ageDays = (Date.now() - new Date(data.published_at).getTime()) / 86_400_000;
  console.log(`[2] /blog freshness: last post ${ageDays.toFixed(1)} days ago`);
  if (ageDays > 14) {
    failures.push('blog-stale');
    await sendAlert(
      '⚠️ BOI Health Alert — /blog stale',
      `Last blog post published ${ageDays.toFixed(1)} days ago.\n\nThreshold: 14 days.\n\nCheck /admin/pending for opinion drafts.`
    );
  }
} catch (e) {
  console.error('[2] blog freshness check failed:', e.message);
  failures.push('blog-check-error');
}

// ── Check 3: RADAR pipeline (> 25 hours = alert) ────────────────────────────
try {
  const { data, error } = await sb
    .from('raw_signals')
    .select('fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  const ageHours = (Date.now() - new Date(data.fetched_at).getTime()) / 3_600_000;
  console.log(`[3] RADAR pipeline: last signal ${ageHours.toFixed(1)}h ago`);
  if (ageHours > 25) {
    failures.push('radar-stale');
    await sendAlert(
      '⚠️ BOI Health Alert — RADAR pipeline stale',
      `Last raw_signal fetched ${ageHours.toFixed(1)} hours ago.\n\nThreshold: 25 hours.\n\nCheck GitHub Actions → radar.yml for failures.`
    );
  }
} catch (e) {
  console.error('[3] RADAR pipeline check failed:', e.message);
  failures.push('radar-check-error');
}

// ── Check 4: Social automation (> 25 hours = alert) ─────────────────────────
try {
  const { data, error } = await sb
    .from('posted_sets')
    .select('posted_at')
    .order('posted_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  const ageHours = (Date.now() - new Date(data.posted_at).getTime()) / 3_600_000;
  console.log(`[4] Social automation: last post ${ageHours.toFixed(1)}h ago`);
  if (ageHours > 25) {
    failures.push('social-stale');
    await sendAlert(
      '⚠️ BOI Health Alert — Social automation stale',
      `Last social post ${ageHours.toFixed(1)} hours ago.\n\nThreshold: 25 hours.\n\nCheck GitHub Actions → social-automation.yml for failures.`
    );
  }
} catch (e) {
  console.error('[4] Social automation check failed:', e.message);
  failures.push('social-check-error');
}

// ── Check 5: Store price scraper (> 7 hours = alert) ────────────────────────
try {
  const { data, error } = await sb
    .from('store_prices')
    .select('scraped_at')
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  const ageHours = (Date.now() - new Date(data.scraped_at).getTime()) / 3_600_000;
  console.log(`[5] Store prices: last scrape ${ageHours.toFixed(1)}h ago`);
  if (ageHours > 7) {
    failures.push('prices-stale');
    await sendAlert(
      '⚠️ BOI Health Alert — Store prices stale',
      `Last store price scraped ${ageHours.toFixed(1)} hours ago.\n\nThreshold: 7 hours (scraper runs every 6h).\n\nCheck GitHub Actions → scrape-prices.yml for failures.`
    );
  }
} catch (e) {
  console.error('[5] Store prices check failed:', e.message);
  failures.push('prices-check-error');
}

// ── Check 6: IG token expiry (within 14 days = alert) ───────────────────────
try {
  const daysUntilExpiry = (IG_TOKEN_EXPIRY.getTime() - Date.now()) / 86_400_000;
  console.log(`[6] IG token: expires in ${daysUntilExpiry.toFixed(0)} days (${IG_TOKEN_EXPIRY.toISOString().slice(0, 10)})`);
  if (daysUntilExpiry <= IG_WARN_DAYS) {
    failures.push('ig-token-expiring');
    await sendAlert(
      '⚠️ BOI Health Alert — Instagram token expiring soon',
      `Instagram access token expires in ${daysUntilExpiry.toFixed(0)} days (${IG_TOKEN_EXPIRY.toISOString().slice(0, 10)}).\n\nRe-exchange the token before it expires to avoid social automation failure.\n\nSee docs for re-exchange process.`
    );
  }
} catch (e) {
  console.error('[6] IG token check failed:', e.message);
  failures.push('ig-check-error');
}

// ── Check 7: Pending drafts backlog (> 50 approved = alert) ─────────────────
try {
  const { count, error } = await sb
    .from('pending_drafts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');
  if (error) throw error;
  console.log(`[7] Pending drafts backlog: ${count} approved and unpublished`);
  if ((count ?? 0) > 50) {
    failures.push('drafts-backlog');
    await sendAlert(
      '⚠️ BOI Health Alert — Pending drafts backlog',
      `${count} approved drafts are waiting to be published.\n\nThreshold: 50.\n\nVisit /admin/pending to review and publish.`
    );
  }
} catch (e) {
  console.error('[7] Pending drafts check failed:', e.message);
  failures.push('drafts-check-error');
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════');
if (failures.length === 0) {
  console.log('  ALL CHECKS PASSED — no alerts sent');
} else {
  console.log(`  ${failures.length} CHECK(S) FAILED: ${failures.join(', ')}`);
  console.log('  Alerts sent via Resend');
}
console.log('═══════════════════════════════\n');

if (failures.some(f => f.endsWith('-error'))) process.exit(1);
