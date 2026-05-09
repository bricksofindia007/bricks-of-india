'use strict';
/**
 * RADAR-05 — Bulk publisher
 *
 * Reads pending_drafts where status='approved' AND draft_body IS NOT NULL,
 * inserts each into the correct table, marks pending_draft status='published'.
 *
 * Target table routing:
 *   draft_format='opinion'  → blog_posts    (category: 'Opinion')
 *   draft_format='review'   → news_articles (category: 'Review')
 *     NOTE: The reviews table requires set_id (FK) and rating (int) — neither
 *     is produced by RADAR-04. Review-format drafts go to news_articles.
 *   everything else         → news_articles (category: 'News')
 *
 * Idempotent: if a slug already exists in the target table the row is skipped
 * (duplicate title/story). Re-running won't duplicate articles.
 *
 * Usage:
 *   node scripts/radar/publish-drafts.js --dry-run
 *   node scripts/radar/publish-drafts.js --limit 5
 *   node scripts/radar/publish-drafts.js --verbose
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const LIMIT   = (() => {
  const i = process.argv.indexOf('--limit');
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : Infinity;
})();

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSlug(title) {
  return (title || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function resolveTarget(format) {
  if (format === 'opinion') return { table: 'blog_posts',    path: '/blog',  category: 'Opinion' };
  if (format === 'review')  return { table: 'news_articles', path: '/news',  category: 'Review'  };
  return                           { table: 'news_articles', path: '/news',  category: 'News'    };
}

function buildExcerpt(body) {
  return (body || '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*+([^*]+)\*+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

async function ensureUniqueSlug(table, baseSlug) {
  let slug = baseSlug;
  let attempt = 2;
  while (true) {
    const { data } = await sb.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug.slice(0, 57)}-${attempt++}`;
    if (attempt > 20) throw new Error(`Cannot generate unique slug for base: ${baseSlug}`);
  }
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function fetchApprovedWithBody() {
  const { data, error } = await sb
    .from('pending_drafts')
    .select('id, draft_title, draft_body, draft_verdict, draft_format, source_url, source_title, iteration_label')
    .eq('status', 'approved')
    .not('draft_body', 'is', null)
    .is('iteration_label', null)
    .order('approved_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const t0   = Date.now();
  const mode = DRY_RUN ? ' [DRY-RUN]' : '';
  console.log(`━━ RADAR-05 bulk publisher${mode} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const rows      = await fetchApprovedWithBody();
  const toProcess = LIMIT === Infinity ? rows : rows.slice(0, LIMIT);
  console.log(`Approved drafts with body: ${rows.length}`);
  if (toProcess.length < rows.length) console.log(`Processing: ${toProcess.length} (--limit applied)`);
  console.log('');

  if (toProcess.length === 0) {
    console.log('Nothing to publish. Approve signals at /admin/pending first, then run RADAR-04.');
    console.log(`\nPUBLISH SUMMARY: processed=0 published=0 skipped=0 failed=0 duration=${((Date.now()-t0)/1000).toFixed(1)}s`);
    return;
  }

  let published = 0;
  let skipped   = 0;
  let failed    = 0;

  for (const draft of toProcess) {
    const format  = draft.draft_format || 'news';
    const { table, path, category } = resolveTarget(format);
    const title   = draft.draft_title || draft.source_title || 'Untitled';
    const baseSlug = generateSlug(title);

    if (VERBOSE) {
      console.log(`[${table}] "${title.slice(0, 70)}"`);
      console.log(`  id=${draft.id} format=${format} slug-base=${baseSlug}`);
    }

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] → ${table} slug=${baseSlug}`);
      published++;
      continue;
    }

    try {
      const slug    = await ensureUniqueSlug(table, baseSlug);
      const excerpt = buildExcerpt(draft.draft_body);
      const now     = new Date().toISOString();

      const { error: insertErr } = await sb.from(table).insert({
        title,
        slug,
        content         : draft.draft_body,
        category,
        excerpt,
        published_at    : now,
        seo_title       : title,
        seo_description : excerpt,
      });

      if (insertErr) {
        // 23505 = unique_violation — slug race condition or duplicate content
        if (insertErr.code === '23505') {
          console.log(`  SKIP: slug conflict for "${slug}" in ${table}`);
          skipped++;
          continue;
        }
        throw insertErr;
      }

      // Mark as published
      await sb
        .from('pending_drafts')
        .update({ status: 'published', published_url: `${path}/${slug}` })
        .eq('id', draft.id);

      console.log(`  ✓ Published → ${table} /${slug}`);
      published++;

    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      failed++;
    }
  }

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('');
  console.log(
    `PUBLISH SUMMARY: processed=${toProcess.length} published=${published} skipped=${skipped} failed=${failed} duration=${dur}s` +
    (DRY_RUN ? ' [DRY-RUN]' : '')
  );
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
