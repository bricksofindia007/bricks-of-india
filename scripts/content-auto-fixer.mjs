/**
 * BOI Content Auto-Fixer
 * Reads auto_fixable=true AND resolved=false issues from content_quality_issues.
 * Applies safe mechanical fixes to article bodies in the DB.
 * Logs every fix to content_fix_log (with before/after).
 *
 * Usage: node --env-file=.env.local scripts/content-auto-fixer.mjs
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

// ── Shared constants (keep in sync with publish-drafts.mjs) ──────────────────

const FORBIDDEN_SUBS = [
  [/\ba testament to\b/gi,         'proof of'],
  [/\ba testament\b/gi,            'a sign'],
  [/\btestament\b/gi,              'proof'],
  [/\bwhimsical\b/gi,              'playful'],
  [/\bpinnacle\b/gi,               'peak'],
  [/\baficionados\b/gi,            'fans'],
  [/\benthusiasts\b/gi,            'fans'],
  [/\bdelve\b/gi,                  'dig into'],
  [/\butilize\b/gi,                'use'],
  [/\bat the end of the day\b/gi,  'ultimately'],
  [/\bunadulterated\b/gi,          'pure'],
  [/\bsiren call\b/gi,             'pull'],
  [/\bfever dreams\b/gi,           'wild visions'],
  [/\bbloke\b/gi,                  'person'],
  [/\bcognoscenti\b/gi,            'experts'],
  [/\bthat[''']s your jam\b/gi,    'that suits you'],
  [/\bit[''']s your jam\b/gi,      "it's for you"],
];

const JAIMAN_SUBS = [
  [/MyBrickHouse,\s*Toycra,\s*and\s*Jaiman\s*Toys/gi, 'MyBrickHouse and Toycra'],
  [/Toycra,\s*and\s*Jaiman\s*Toys/gi,                 'Toycra'],
  [/MyBrickHouse\s*and\s*Jaiman\s*Toys/gi,             'MyBrickHouse and Toycra'],
  [/,?\s*and\s*Jaiman\s*Toys/gi,                       ''],
  [/Jaiman\s*Toys/gi,                                  'Toycra'],
];

const SIGNOFF = 'On that bombshell, bubyee.';

// ── Fix functions ─────────────────────────────────────────────────────────────

function applyFix(checkName, body) {
  switch (checkName) {
    case 'markdown_asterisk':
      // Strip single-star emphasis (*text*) — not double-star
      return body.replace(/(?<!\*)\*(?!\*)([^*\n]{1,200})(?<!\*)\*(?!\*)/g, '$1');

    case 'markdown_bold':
      return body.replace(/\*\*([^*\n]{1,200})\*\*/g, '$1');

    case 'markdown_header':
      // Strip # prefix, keep heading text as plain paragraph
      return body.replace(/^#{1,6}\s+(.+)$/gm, '$1');

    case 'markdown_list':
      // Strip - or * list markers at line start, keep text
      return body.replace(/^(\s*)[-*]\s+/gm, '$1');

    case 'double_space':
      // Collapse multiple spaces to single (loop until stable)
      let s = body;
      while (s.includes('  ')) s = s.replace(/  /g, ' ');
      return s;

    case 'trailing_space':
      return body.replace(/[ \t]+$/gm, '');

    case 'consecutive_blank_lines':
      return body.replace(/\n{3,}/g, '\n\n');

    case 'capitalisation_error': {
      // Capitalise first letter after ". " only at clear sentence boundaries
      // Skip: URLs, set numbers (4+ digit sequences), abbreviations
      return body.replace(/\.\s+([a-z])(?=[a-z]{2,})/g, (match, letter, offset) => {
        const context = body.slice(Math.max(0, offset - 20), offset + 20);
        // Skip if looks like URL or set number context
        if (/https?:|www\.|\/\/|[0-9]{4,}/.test(context)) return match;
        return match.slice(0, match.length - 1) + letter.toUpperCase();
      });
    }

    case 'html_comment_visible':
      return body.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim();

    case 'india_paragraph_marker':
      // Remove the marker text but keep the paragraph content after it
      return body.replace(/<!--\s*INDIA_PARAGRAPH\s*-->\n?/g, '').trim();

    case 'draft_marker_leaked':
      // Remove BOI_DRAFT markers and any leaked header lines
      return body
        .replace(/---\s*BOI_DRAFT_START\s*---\n?/g, '')
        .replace(/---\s*BOI_DRAFT_END\s*---\n?/g, '')
        .replace(/^(FORMAT|TITLE|VERDICT|BODY):\s*.*/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    case 'jaiman_reference': {
      let jb = body;
      for (const [re, sub] of JAIMAN_SUBS) jb = jb.replace(re, sub);
      return jb;
    }

    case 'forbidden_word': {
      let fb = body;
      for (const [re, sub] of FORBIDDEN_SUBS) fb = fb.replace(re, sub);
      return fb;
    }

    case 'missing_verdict': {
      // Remove any standalone NONE placeholder, then insert WAIT before signoff
      let vb = body.replace(/^NONE\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
      if (/on that bombshell/i.test(vb)) {
        vb = vb.replace(/(On that bombshell)/i, '**Verdict: WAIT**\n\n$1');
      } else {
        vb = vb.replace(/\s+$/, '') + '\n\n**Verdict: WAIT**';
      }
      return vb;
    }

    case 'missing_signoff':
      if (/on that bombshell/i.test(body)) return body;
      return body.replace(/\s+$/, '') + '\n\n' + SIGNOFF;

    default:
      return body; // no-op for unknown checks
  }
}

// ── Safety guard ──────────────────────────────────────────────────────────────

function safetyCheck(before, after, slug) {
  if (!after || after.trim().length === 0) {
    return `Fix produced empty body for ${slug} — aborting`;
  }
  const lenBefore = before.length;
  const lenAfter  = after.length;
  const ratio = lenAfter / lenBefore;
  if (ratio < 0.8 || ratio > 1.2) {
    return `Body length changed by ${Math.round((1 - ratio) * 100)}% (${lenBefore} → ${lenAfter}) — outside 20% safety window for ${slug}`;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Load all auto-fixable unresolved issues
const { data: openIssues, error: fetchErr } = await sb
  .from('content_quality_issues')
  .select('id, article_slug, section, check_name')
  .eq('auto_fixable', true)
  .eq('resolved', false);

if (fetchErr) { console.error('Fetch error:', fetchErr.message); process.exit(1); }
if (!openIssues?.length) { console.log('No auto-fixable issues found — all clean.'); process.exit(0); }

console.log(`Found ${openIssues.length} auto-fixable issues across ${new Set(openIssues.map(i => i.article_slug)).size} articles\n`);

// Group by article (slug + section)
const byArticle = {};
for (const issue of openIssues) {
  const key = `${issue.section}|${issue.article_slug}`;
  if (!byArticle[key]) byArticle[key] = { section: issue.section, slug: issue.article_slug, issues: [] };
  byArticle[key].issues.push(issue);
}

const tableFor = { news_articles: 'news_articles', blog_posts: 'blog_posts', reviews: 'reviews', guides: 'guides' };

let applied = 0, aborted = 0;

for (const { section, slug, issues } of Object.values(byArticle)) {
  const table = tableFor[section];
  if (!table) continue;

  const { data: art } = await sb.from(table).select('content').eq('slug', slug).single();
  if (!art?.content) { console.log(`  SKIP (not found): ${slug}`); continue; }

  let body = art.content;
  const bodyBefore = body;
  const checksApplied = [];

  // Apply each fix in dependency order (order matters for compound fixes)
  const ORDER = [
    'draft_marker_leaked', 'html_comment_visible', 'india_paragraph_marker',
    'jaiman_reference',                                                         // remove stale store
    'forbidden_word',                                                            // word substitutions
    'markdown_bold', 'markdown_asterisk', 'markdown_header', 'markdown_list',
    'consecutive_blank_lines', 'double_space', 'trailing_space', 'capitalisation_error',
    'missing_verdict',                                                           // before signoff: inserts WAIT + cleans NONE
    'missing_signoff',                                                           // last: may add words
  ];
  const issueChecks = issues.map(i => i.check_name);
  for (const check of ORDER) {
    if (!issueChecks.includes(check)) continue;
    const fixed = applyFix(check, body);
    if (fixed !== body) { body = fixed; checksApplied.push(check); }
  }

  if (checksApplied.length === 0) {
    // Issues listed but no actual change needed — mark resolved anyway
    for (const issue of issues) {
      await sb.from('content_quality_issues')
        .update({ resolved: true, resolved_at: new Date().toISOString(), fix_detail: 'No change needed — already clean' })
        .eq('id', issue.id);
    }
    continue;
  }

  // Safety check
  const safetyErr = safetyCheck(bodyBefore, body, slug);
  if (safetyErr) {
    console.log(`  ABORT: ${safetyErr}`);
    // Escalate to manual
    for (const issue of issues) {
      await sb.from('content_quality_issues')
        .update({ auto_fixable: false, fix_detail: `Auto-fix aborted: ${safetyErr}` })
        .eq('id', issue.id);
    }
    aborted++;
    continue;
  }

  // Log to content_fix_log
  await sb.from('content_fix_log').insert({
    fixed_at:     new Date().toISOString(),
    article_slug: slug,
    section,
    fix_type:     checksApplied.join(', '),
    body_before:  bodyBefore,
    body_after:   body,
    issue_id:     issues[0].id,
  });

  // Write fixed content
  const { error: updateErr } = await sb.from(table).update({ content: body }).eq('slug', slug);
  if (updateErr) {
    console.log(`  ERR: ${slug} — ${updateErr.message}`);
    aborted++;
    continue;
  }

  // Mark all issues for this article as resolved
  const fixDetail = `Fixed: ${checksApplied.join(', ')}`;
  for (const issue of issues) {
    await sb.from('content_quality_issues')
      .update({ resolved: true, resolved_at: new Date().toISOString(), fix_detail: fixDetail })
      .eq('id', issue.id);
  }

  applied++;
  process.stdout.write(`  ✓ ${slug.slice(0, 55)} [${checksApplied.join(', ')}]\n`);
}

console.log(`\nAuto-fixer complete: ${applied} fixes applied`);
console.log(`${aborted} aborted (safety check failed)`);
const stillOpen = openIssues.length - (applied + aborted) * (openIssues.length / Object.keys(byArticle).length || 1);
console.log(`${Math.max(0, openIssues.filter(i => i).length - applied)} remaining for manual review`);
