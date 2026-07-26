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

// GITHUB_ACTIONS=true is set automatically by every real Actions run -- nothing
// to remember to flip. Local/manual runs (including verification testing) never
// hit the real inbox by default; FORCE_REAL_ALERTS=true is an explicit, deliberate
// opt-in for the rare case a live send genuinely needs testing outside Actions.
// Added 2026-07-26 after a verification pass sent real alerts to the production
// address from local test runs (see BOI_MASTER_TRACKER.md this date).
const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === 'true';
const FORCE_REAL_ALERTS = process.env.FORCE_REAL_ALERTS === 'true';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const failures = [];

async function sendAlert(subject, body) {
  if (!IS_GITHUB_ACTIONS && !FORCE_REAL_ALERTS) {
    console.warn(`[TEST MODE — not in GitHub Actions, alert NOT sent] ${subject}`);
    return;
  }
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
  if (!res.ok) {
    console.error(`Resend failed (${res.status}): ${await res.text()}`);
  } else {
    const sent = await res.json();
    console.log(`[alert] Email sent. ID: ${sent.id}`);
  }
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
  await sendAlert(
    '🔥 [BOI INFRA FAILURE] — /news freshness check crashed',
    `Check 1 itself failed to run (this is not a normal staleness alert): ${e.message}\n\nThe health check's own query broke — Supabase error, schema drift, or similar. The real /news freshness state is unknown until this is fixed. Investigate scripts/health-check.mjs Check 1 directly.`
  );
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
  await sendAlert(
    '🔥 [BOI INFRA FAILURE] — /blog freshness check crashed',
    `Check 2 itself failed to run (this is not a normal staleness alert): ${e.message}\n\nThe health check's own query broke — Supabase error, schema drift, or similar. The real /blog freshness state is unknown until this is fixed. Investigate scripts/health-check.mjs Check 2 directly.`
  );
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
  await sendAlert(
    '🔥 [BOI INFRA FAILURE] — RADAR pipeline check crashed',
    `Check 3 itself failed to run (this is not a normal staleness alert): ${e.message}\n\nThe health check's own query broke — Supabase error, schema drift, or similar. The real RADAR pipeline state is unknown until this is fixed. Investigate scripts/health-check.mjs Check 3 directly.`
  );
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
  await sendAlert(
    '🔥 [BOI INFRA FAILURE] — Social automation check crashed',
    `Check 4 itself failed to run (this is not a normal staleness alert): ${e.message}\n\nThe health check's own query broke — Supabase error, schema drift, or similar. The real social automation state is unknown until this is fixed. Investigate scripts/health-check.mjs Check 4 directly.`
  );
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
  await sendAlert(
    '🔥 [BOI INFRA FAILURE] — Store price scraper check crashed',
    `Check 5 itself failed to run (this is not a normal staleness alert): ${e.message}\n\nThe health check's own query broke — Supabase error, schema drift, or similar. The real store price freshness state is unknown until this is fixed. Investigate scripts/health-check.mjs Check 5 directly.`
  );
}

// ── Check 5b: Scrape coverage — % of in-stock rows fresh (<7h) ───────────────
try {
  const cutoff5b = new Date(Date.now() - 7 * 3_600_000).toISOString();
  const stores5b = ['toycra', 'mybrickhouse'];
  for (const store of stores5b) {
    const [{ count: total }, { count: fresh }] = await Promise.all([
      sb.from('store_prices').select('*', { count: 'exact', head: true })
        .eq('store_id', store).eq('in_stock', true),
      sb.from('store_prices').select('*', { count: 'exact', head: true })
        .eq('store_id', store).eq('in_stock', true).gte('scraped_at', cutoff5b),
    ]);
    const pct = total > 0 ? Math.round((fresh / total) * 100) : 0;
    console.log(`[5b] ScrapeCoverage ${store}: ${fresh}/${total} in-stock rows fresh (<7h) = ${pct}%`);
    if (pct < 80) {
      failures.push(`scrape-coverage-${store}`);
      await sendAlert(
        `⚠️ BOI Health Alert — Scrape coverage low: ${store}`,
        `Only ${pct}% of in-stock rows for ${store} scraped in last 7h (${fresh}/${total}).\n\nThreshold: 80%.\n\nCheck GitHub Actions → scrape-prices.yml.`
      );
    }
  }
} catch (e) {
  console.error('[5b] ScrapeCoverage check failed:', e.message);
  failures.push('scrape-coverage-error');
  await sendAlert(
    '🔥 [BOI INFRA FAILURE] — Scrape coverage check crashed',
    `Check 5b itself failed to run (this is not a normal coverage-threshold alert): ${e.message}\n\nThe health check's own query broke — Supabase error, schema drift, or similar. The real scrape coverage state is unknown until this is fixed. Investigate scripts/health-check.mjs Check 5b directly.`
  );
}

// ── Check 6: Instagram heartbeat ─────────────────────────────────────────────
// Replaces the old hardcoded-expiry-date check (removed 2026-07-26 -- it never
// tracked the real token, so once the constant's date passed it fired a false
// "expiring soon" alert every single day forever, regardless of actual token
// state). Reads the same social_automation_heartbeat table Check 6c already
// uses for YouTube -- real success/failure signal instead of a guessed date.
// Primary alert  (26h): last_attempt_at stale -> workflow itself hasn't run
// Secondary alert (72h): last_success_at stale -> workflow runs but IG never succeeds
try {
  const { data: igHb, error: igHbErr } = await sb
    .from('social_automation_heartbeat')
    .select('last_attempt_at, last_success_at')
    .eq('platform', 'instagram')
    .single();
  if (igHbErr) throw igHbErr;

  if (!igHb.last_attempt_at) {
    failures.push('ig-heartbeat-never-ran');
    await sendAlert(
      '⚠️ BOI Health Alert — Instagram pipeline never ran',
      'social_automation_heartbeat.instagram.last_attempt_at is NULL — social-automation.yml has never written a heartbeat.\n\nCheck that the migration was applied and the workflow is running.'
    );
  } else {
    const igAttemptAge = (Date.now() - new Date(igHb.last_attempt_at).getTime()) / 3_600_000;
    console.log(`[6] Instagram heartbeat: last attempt ${igAttemptAge.toFixed(1)}h ago`);
    if (igAttemptAge > 26) {
      failures.push('ig-heartbeat-stale');
      await sendAlert(
        '⚠️ BOI Health Alert — Instagram pipeline not attempting',
        `social-automation.yml last ran ${igAttemptAge.toFixed(1)} hours ago.\n\nThreshold: 26 hours (runs daily at 12:00 IST).\n\nCheck GitHub Actions → social-automation.yml for failures or missed triggers.`
      );
    } else if (igHb.last_success_at) {
      const igSuccessAge = (Date.now() - new Date(igHb.last_success_at).getTime()) / 3_600_000;
      console.log(`[6] Instagram heartbeat: last success ${igSuccessAge.toFixed(1)}h ago`);
      if (igSuccessAge > 72) {
        failures.push('ig-heartbeat-no-success');
        await sendAlert(
          '⚠️ BOI Health Alert — Instagram not posting',
          `Pipeline is running (last attempt ${igAttemptAge.toFixed(1)}h ago) but last successful Instagram post was ${igSuccessAge.toFixed(1)} hours ago.\n\nThreshold: 72 hours.\n\nLikely causes: token expiry/invalidation, no eligible sets, or post error. Check social-automation.yml logs.`
        );
      }
    } else {
      console.log('[6] Instagram heartbeat: pipeline running but no successful post yet');
    }
  }
} catch (e) {
  console.error('[6] Instagram heartbeat check failed:', e.message);
  failures.push('ig-heartbeat-error');
  await sendAlert(
    '🔥 [BOI INFRA FAILURE] — Instagram heartbeat check crashed',
    `Check 6 itself failed to run (this is not a normal heartbeat-staleness alert): ${e.message}\n\nThe health check's own query broke — Supabase error, schema drift, or similar. The real Instagram heartbeat state is unknown until this is fixed. Investigate scripts/health-check.mjs Check 6 directly.`
  );
}

// ── Check 6b: YouTube token expiry ───────────────────────────────────────────
try {
  const ytSecrets = (process.env.YOUTUBE_CLIENT_SECRETS || '').replace(/^﻿/, '').trim();
  if (!ytSecrets) {
    failures.push('yt-token-missing');
    await sendAlert(
      '⚠️ BOI Health Alert — YouTube token missing',
      'YOUTUBE_CLIENT_SECRETS not set — YouTube Shorts upload will be skipped.\n\nRe-authenticate via social-automation/youtube_oauth_helper.py and update the GitHub Secret.'
    );
  } else {
    const creds = JSON.parse(ytSecrets);
    const expiry = new Date(creds.expiry);
    const daysLeft = Math.floor((expiry - new Date()) / (1000 * 60 * 60 * 24));
    console.log(`[6b] YouTube token: expires in ${daysLeft} day(s) (${expiry.toISOString().slice(0, 10)})`);
    if (daysLeft <= 3) {
      failures.push('yt-token-expiring');
      await sendAlert(
        '⚠️ BOI Health Alert — YouTube token expiring',
        `Token expires in ${daysLeft} day(s) — re-auth required via social-automation/youtube_oauth_helper.py.\n\nUpdate YOUTUBE_CLIENT_SECRETS in GitHub Secrets before it expires.`
      );
    }
  }
} catch (e) {
  console.error('[6b] YouTube token check failed:', e.message);
  failures.push('yt-token-malformed');
  await sendAlert(
    '⚠️ BOI Health Alert — YouTube token malformed',
    `YOUTUBE_CLIENT_SECRETS cannot be parsed: ${e.message}\n\nRe-authenticate via social-automation/youtube_oauth_helper.py and update the GitHub Secret.`
  );
}

// ── Check 6c: YouTube heartbeat ──────────────────────────────────────────────
// Primary alert  (26h): last_attempt_at stale → workflow itself hasn't run
// Secondary alert (72h): last_success_at stale → workflow runs but YouTube never succeeds
try {
  const { data: hb, error: hbErr } = await sb
    .from('social_automation_heartbeat')
    .select('last_attempt_at, last_success_at')
    .eq('platform', 'youtube')
    .single();
  if (hbErr) throw hbErr;

  if (!hb.last_attempt_at) {
    failures.push('yt-heartbeat-never-ran');
    await sendAlert(
      '⚠️ BOI Health Alert — YouTube pipeline never ran',
      'social_automation_heartbeat.youtube.last_attempt_at is NULL — social-automation.yml has never written a heartbeat.\n\nCheck that the migration was applied and the workflow is running.'
    );
  } else {
    const attemptAge = (Date.now() - new Date(hb.last_attempt_at).getTime()) / 3_600_000;
    console.log(`[6c] YouTube heartbeat: last attempt ${attemptAge.toFixed(1)}h ago`);
    if (attemptAge > 26) {
      failures.push('yt-heartbeat-stale');
      await sendAlert(
        '⚠️ BOI Health Alert — YouTube pipeline not attempting',
        `social-automation.yml last ran ${attemptAge.toFixed(1)} hours ago.\n\nThreshold: 26 hours (runs daily at 12:00 IST).\n\nCheck GitHub Actions → social-automation.yml for failures or missed triggers.`
      );
    } else if (hb.last_success_at) {
      const successAge = (Date.now() - new Date(hb.last_success_at).getTime()) / 3_600_000;
      console.log(`[6c] YouTube heartbeat: last success ${successAge.toFixed(1)}h ago`);
      if (successAge > 72) {
        failures.push('yt-heartbeat-no-success');
        await sendAlert(
          '⚠️ BOI Health Alert — YouTube not uploading',
          `Pipeline is running (last attempt ${attemptAge.toFixed(1)}h ago) but last successful YouTube upload was ${successAge.toFixed(1)} hours ago.\n\nThreshold: 72 hours.\n\nLikely causes: token expiry, no eligible sets, or upload error. Check social-automation.yml logs.`
        );
      }
    } else {
      // last_attempt_at fresh but last_success_at NULL — pipeline ran, never succeeded
      console.log('[6c] YouTube heartbeat: pipeline running but no successful upload yet');
    }
  }
} catch (e) {
  console.error('[6c] YouTube heartbeat check failed:', e.message);
  failures.push('yt-heartbeat-error');
  await sendAlert(
    '🔥 [BOI INFRA FAILURE] — YouTube heartbeat check crashed',
    `Check 6c itself failed to run (this is not a normal heartbeat-staleness alert): ${e.message}\n\nThe health check's own query broke — Supabase error, schema drift, or similar. The real YouTube heartbeat state is unknown until this is fixed. Investigate scripts/health-check.mjs Check 6c directly.`
  );
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
  await sendAlert(
    '🔥 [BOI INFRA FAILURE] — Pending drafts backlog check crashed',
    `Check 7 itself failed to run (this is not a normal backlog-threshold alert): ${e.message}\n\nThe health check's own query broke — Supabase error, schema drift, or similar. The real pending drafts backlog state is unknown until this is fixed. Investigate scripts/health-check.mjs Check 7 directly.`
  );
}

// ── Check 8: Per-store in-stock counts (alert if any store < 50) ─────────────
// Full 20%-drop detection requires cross-day comparison; this catches complete failures.
try {
  const stores = ['mybrickhouse', 'toycra'];
  const counts = {};
  for (const store of stores) {
    const { count } = await sb
      .from('store_prices')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', store)
      .eq('in_stock', true);
    counts[store] = count ?? 0;
  }
  const countStr = stores.map(s => `${s}: ${counts[s]}`).join(', ');
  console.log(`[8] Store in-stock counts: ${countStr}`);
  const failed = stores.filter(s => counts[s] < 50);
  if (failed.length > 0) {
    failures.push('store-count-low');
    await sendAlert(
      '⚠️ BOI Health Alert — Store price count critically low',
      `In-stock counts: ${countStr}\n\nStores below threshold (50): ${failed.join(', ')}\n\nScraper may have failed. Check GitHub Actions → scrape-prices.yml.`
    );
  }
} catch (e) {
  console.error('[8] Store count check failed:', e.message);
  failures.push('store-count-error');
  await sendAlert(
    '🔥 [BOI INFRA FAILURE] — Store price count check crashed',
    `Check 8 itself failed to run (this is not a normal low-count alert): ${e.message}\n\nThe health check's own query broke — Supabase error, schema drift, or similar. The real store price count state is unknown until this is fixed. Investigate scripts/health-check.mjs Check 8 directly.`
  );
}

// ── Check 9: Cron success timestamps (> 26 hours = alert) ────────────────────
try {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO         = process.env.GITHUB_REPOSITORY ?? 'bricksofindia007/bricks-of-india';
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not set');

  const workflows = [
    { file: 'radar.yml',          label: 'RADAR pipeline'   },
    { file: 'social-automation.yml', label: 'Social automation' },
    { file: 'scrape-prices.yml',  label: 'Price scraper'    },
    { file: 'generate-drafts.yml', label: 'Batch generator' },
  ];

  for (const wf of workflows) {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${wf.file}/runs?per_page=1`,
      { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' } }
    );
    if (!res.ok) { console.warn(`[9] ${wf.file}: API error ${res.status}`); continue; }
    const json = await res.json();
    const lastRun = json.workflow_runs?.[0];
    if (!lastRun) { console.log(`[9] ${wf.label}: no runs found`); continue; }
    const ageHours = (Date.now() - new Date(lastRun.created_at).getTime()) / 3_600_000;
    const status   = lastRun.conclusion ?? lastRun.status;
    console.log(`[9] ${wf.label}: last run ${ageHours.toFixed(1)}h ago (${status})`);
    if (ageHours > 26) {
      failures.push(`cron-stale-${wf.file}`);
      await sendAlert(
        `⚠️ BOI Health Alert — ${wf.label} cron stale`,
        `Workflow: ${wf.file}\nLast run: ${ageHours.toFixed(1)} hours ago (${lastRun.created_at})\nStatus: ${status}\n\nThreshold: 26 hours.\n\nCheck GitHub Actions for failures.`
      );
    }
  }
} catch (e) {
  console.error('[9] Cron timestamp check failed:', e.message);
  failures.push('cron-check-error');
  await sendAlert(
    '🔥 [BOI INFRA FAILURE] — Cron timestamp check crashed',
    `Check 9 itself failed to run (this is not a normal cron-stale alert): ${e.message}\n\nLikely GITHUB_TOKEN missing or the GitHub API call failing — not a workflow being stale, the check itself broke. Investigate scripts/health-check.mjs Check 9 directly.`
  );
}

// ── Check 10: Sets with zero store coverage (log weekly, no alert) ────────────
try {
  // Count distinct set_ids in store_prices
  let coveredSetIds = new Set();
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await sb.from('store_prices').select('set_id').range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    data.forEach(r => coveredSetIds.add(r.set_id));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  const { count: totalSets } = await sb.from('sets').select('*', { count: 'exact', head: true });
  const uncovered = (totalSets ?? 0) - coveredSetIds.size;
  const pct = totalSets ? ((coveredSetIds.size / totalSets) * 100).toFixed(1) : '0';
  console.log(`[10] Store coverage: ${coveredSetIds.size}/${totalSets} sets covered (${pct}%), ${uncovered} with zero coverage`);
} catch (e) {
  console.error('[10] Store coverage check failed:', e.message);
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════');
if (failures.length === 0) {
  console.log('  ALL CHECKS PASSED — no alerts sent');
} else {
  console.log(`  ${failures.length} CHECK(S) FAILED: ${failures.join(', ')}`);
  console.log(
    IS_GITHUB_ACTIONS || FORCE_REAL_ALERTS
      ? '  Alerts sent via Resend'
      : '  TEST MODE — no real alerts sent (see [TEST MODE] lines above)'
  );
}
console.log('═══════════════════════════════\n');

if (failures.some(f => f.endsWith('-error'))) process.exit(1);
