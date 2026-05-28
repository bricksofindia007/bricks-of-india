/**
 * BOI Content Verifier
 * Re-runs linter checks ONLY on articles auto-fixed in the current run.
 * Confirms fixes held or escalates to manual if issues persist.
 *
 * Usage: node --env-file=.env.local scripts/content-verify.mjs
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
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env vars'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── Load issues fixed in the last 2 hours ─────────────────────────────────────

const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const { data: recentlyFixed, error } = await sb
  .from('content_quality_issues')
  .select('id, article_slug, section, check_name, resolved_at')
  .eq('resolved', true)
  .eq('auto_fixable', true)
  .gte('resolved_at', since);

if (error) { console.error('Fetch error:', error.message); process.exit(1); }
if (!recentlyFixed?.length) {
  console.log('No auto-fixes to verify in the last 2 hours — skipping.');
  process.exit(0);
}

console.log(`Verifying ${recentlyFixed.length} recently auto-fixed issues…\n`);

const tableFor = { news_articles: 'news_articles', blog_posts: 'blog_posts', reviews: 'reviews', guides: 'guides' };

// ── Re-run checks ─────────────────────────────────────────────────────────────

function stillPresent(checkName, body) {
  switch (checkName) {
    case 'markdown_asterisk':
      return /(?<!\*)\*(?!\*)([^*\n]{1,100})(?<!\*)\*(?!\*)/.test(body);
    case 'markdown_bold':
      return /\*\*([^*\n]{1,100})\*\*/.test(body);
    case 'markdown_header':
      return /^#{1,6}\s/m.test(body);
    case 'markdown_list':
      return /^\s*[-*]\s+\S/m.test(body);
    case 'double_space':
      return body.includes('  ');
    case 'trailing_space':
      return body.split('\n').some(l => /\s+$/.test(l));
    case 'consecutive_blank_lines':
      return /\n{3,}/.test(body);
    case 'capitalisation_error':
      return /\.\s+[a-z][a-z]{2,}/.test(body);
    case 'html_comment_visible':
      return body.includes('<!--');
    case 'india_paragraph_marker':
      return body.includes('INDIA_PARAGRAPH');
    case 'draft_marker_leaked':
      return body.includes('BOI_DRAFT_START') || body.includes('BOI_DRAFT_END');
    default:
      return false;
  }
}

let confirmed = 0, failed = 0;

// Group by article
const byArticle = {};
for (const issue of recentlyFixed) {
  const key = `${issue.section}|${issue.article_slug}`;
  if (!byArticle[key]) byArticle[key] = { section: issue.section, slug: issue.article_slug, issues: [] };
  byArticle[key].issues.push(issue);
}

for (const { section, slug, issues } of Object.values(byArticle)) {
  const table = tableFor[section];
  if (!table) continue;

  const { data: art } = await sb.from(table).select('content').eq('slug', slug).single();
  if (!art?.content) continue;

  for (const issue of issues) {
    const persists = stillPresent(issue.check_name, art.content);
    if (persists) {
      // Escalate
      await sb.from('content_quality_issues')
        .update({
          resolved:   false,
          resolved_at: null,
          auto_fixable: false,
          fix_detail:  'Fix attempted but issue persists — manual review needed',
          severity:    'critical',
        })
        .eq('id', issue.id);
      console.log(`  FAIL: ${slug.slice(0, 50)} [${issue.check_name}] — escalated to manual`);
      failed++;
    } else {
      confirmed++;
    }
  }
}

console.log(`\nVerify complete:`);
console.log(`${confirmed} fixes confirmed resolved`);
console.log(`${failed} fixes failed — escalated to manual`);
