#!/usr/bin/env node
// Public-key access check (A4). Read-only: never writes. Runs against STAGING with the public key.
// 1. The listed internal relations refuse the public key (permission denied).
// 2. The site's public reads still work (rows come back).
// 3. Writes are refused: an UPDATE whose filter matches nothing still fails with 42501 when the
//    privilege is missing, so the check never changes data.
// Prints counts and names of failures only.
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_PUBLIC_KEY;
if (!URL || !KEY) { console.error('SUPABASE_URL / SUPABASE_PUBLIC_KEY missing'); process.exit(2); }
export const CLOSED = ['stores', 'price_snapshots', 'v_scan_batch_health', 'pending_drafts', 'pending_drafts_lint_results_backup_20260620',
  'raw_signals', 'generator_runs', 'content_quality_issues', 'content_quality_issues_archive', 'content_fix_log', 'content_image_registry',
  'content_rejections', 'content_rejection_reminders', 'image_repair_queue', 'opinion_cadence_log', 'catalog_coverage_trend', 'posted_sets',
  'posted_lego_sets', 'quiet_panic_posts', 'video_posts', 'social_automation_heartbeat', 'newsletter_subscribers'];
export const OPEN = ['sets', 'reviews', 'news_articles', 'guides', 'store_prices', 'price_history', 'featured_videos', 'cmf_figures', 'v_published_articles_public'];
const WRITE_PROBE = ['sets', 'reviews', 'news_articles', 'store_prices', 'stores'];
const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const get = async (t) => { const r = await fetch(`${URL}/rest/v1/${t}?select=*&limit=1`, { headers: h }); return { status: r.status, body: await r.text() }; };
let fails = [];
for (const t of CLOSED) { const r = await get(t); if (!(r.status === 401 || r.status === 403) || !/42501|permission denied/.test(r.body)) fails.push(`open: ${t} (${r.status})`); }
for (const t of OPEN) { const r = await get(t); if (r.status !== 200) fails.push(`closed: ${t} (${r.status})`); }
for (const t of WRITE_PROBE) {
  const r = await fetch(`${URL}/rest/v1/${t}?id=eq.00000000-0000-0000-0000-000000000000`, { method: 'PATCH', headers: { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: '{"id":"00000000-0000-0000-0000-000000000000"}' });
  const b = await r.text(); if (!/42501|permission denied/.test(b)) fails.push(`write not refused: ${t} (${r.status})`);
}
// A made-up id: the call can't change anything. Before the lockdown the error names the TABLE; after, the FUNCTION.
const rpc = await fetch(`${URL}/rest/v1/rpc/reject_video_post`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_video_id: '00000000-0000-0000-0000-000000000000', p_reason: 'check' }) });
if (!/permission denied for function/.test(await rpc.text())) fails.push('function still callable: reject_video_post');
console.log(`public-key check: ${CLOSED.length} closed, ${OPEN.length} open, ${WRITE_PROBE.length} write probes, 1 function -> ${fails.length ? 'FAIL ' + fails.length : 'PASS'}`);
for (const f of fails) console.log('  ' + f);
process.exit(fails.length ? 1 : 0);
