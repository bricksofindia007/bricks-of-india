// scripts/fix-opener-templates.mjs
// One-time retro-fix for the opener template epidemic (2026-07-02 audit item #2).
//
// Gate 8 (opener uniqueness, shipped 2026-07-01 commit a32b8a6) stops NEW
// template reuse, but the published corpus still carries it — the homepage on
// 2026-07-02 showed two adjacent same-day cards both opening "Your wallet
// called. It wants to discuss…", plus at least three more live instances.
// That is the single most visible quality flaw to a reader (or an RLFM
// reviewer) browsing the site today.
//
// What this does:
//   1. Pulls all news_articles + blog_posts, normalizes each opener with the
//      SAME normalization Gate 8 uses (inlined below to keep this .mjs
//      dependency-free), and clusters openers at >=85% Levenshtein similarity.
//   2. In every cluster of 2+, the OLDEST article keeps its opener (it was
//      first; it isn't the copy). Every later member gets its first paragraph
//      rewritten by Gemini (gemini-2.5-flash-lite, same production model)
//      under strict constraints: rewrite ONLY the opening 1–2 sentences,
//      preserve every fact/number/set name, keep BOI voice, similar length.
//   3. Each rewrite is re-verified: new opener must be <85% similar to EVERY
//      other opener in the corpus AND to every rewrite accepted earlier in
//      this run. Fail => one retry with feedback => still fail => SKIP (never
//      publish a bad rewrite; log for manual pass).
//   4. DRY-RUN BY DEFAULT. Prints before/after for every candidate. Nothing
//      is written without --apply.
//
// Usage: node scripts/fix-opener-templates.mjs            (dry run)
//        node scripts/fix-opener-templates.mjs --apply    (write to DB)
//
// Notes for the operator:
//   - seo_description/excerpt are regenerated from the new body when the old
//     excerpt was derived from the rewritten paragraph (word-boundary, ≤160).
//   - updated_at is set so ISR revalidation picks it up; slugs/titles untouched.
//   - Expect roughly 5–15 clusters. Read the dry-run output before --apply.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
      const eq = line.indexOf('=');
      if (eq === -1 || line.trim().startsWith('#')) continue;
      const k = line.slice(0, eq).trim();
      if (!env[k]) env[k] = line.slice(eq + 1).trim();
    }
  } catch { /* CI */ }
  return env;
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const GEMINI_KEY = env.GEMINI_API_KEY;
const APPLY = process.argv.includes('--apply');
const MODEL = 'gemini-2.5-flash-lite';
const THRESHOLD = 0.85;

if (!GEMINI_KEY) { console.error('GEMINI_API_KEY missing'); process.exit(1); }

// ── Gate 8 normalization + Levenshtein (mirrors src/lib/lint.ts) ─────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
  return dp[m][n];
}
function normalizeOpener(body) {
  return (String(body ?? '').split(/\n\n/)[0] ?? '')
    .slice(0, 150).toLowerCase()
    .replace(/\b\d{4,6}\b/g, '').replace(/\d+/g, '')
    .replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 55);
}
function similarity(a, b) {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 0 : 1 - levenshtein(a, b) / maxLen;
}

// ── Load corpus ───────────────────────────────────────────────────────────────
async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table)
      .select('id,slug,title,content,excerpt,seo_description,created_at')
      .order('created_at', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []).map(r => ({ ...r, table })));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const corpus = [...await fetchAll('news_articles'), ...await fetchAll('blog_posts')];
for (const r of corpus) r.norm = normalizeOpener(r.content);
console.log(`Corpus: ${corpus.length} articles`);

// ── Cluster (oldest-first, so cluster[0] is the keeper) ───────────────────────
const clusters = [];
const assigned = new Set();
for (let i = 0; i < corpus.length; i++) {
  if (assigned.has(i) || corpus[i].norm.length < 20) continue;
  const cluster = [i];
  for (let j = i + 1; j < corpus.length; j++) {
    if (assigned.has(j) || corpus[j].norm.length < 20) continue;
    if (similarity(corpus[i].norm, corpus[j].norm) >= THRESHOLD) { cluster.push(j); assigned.add(j); }
  }
  if (cluster.length >= 2) { clusters.push(cluster); assigned.add(i); }
}
const rewriteTargets = clusters.flatMap(c => c.slice(1).map(idx => corpus[idx]));
console.log(`Clusters of 2+: ${clusters.length} — articles needing an opener rewrite: ${rewriteTargets.length}\n`);
for (const c of clusters) {
  console.log(`— keeper: [${corpus[c[0]].table}] ${corpus[c[0]].slug}`);
  for (const idx of c.slice(1)) console.log(`  rewrite: [${corpus[idx].table}] ${corpus[idx].slug}  "${corpus[idx].norm.slice(0, 45)}…"`);
}
if (rewriteTargets.length === 0) { console.log('Nothing to do.'); process.exit(0); }

// ── Gemini rewrite ────────────────────────────────────────────────────────────
async function geminiRewrite(article, firstPara, feedback) {
  const prompt = `You are the editor of Bricks of India. Voice: Jeremy Clarkson meets Indian wallet anxiety — dry, witty, specific.

Below is the OPENING PARAGRAPH of a published article titled "${article.title}". Its first sentence uses an overused house template. Rewrite ONLY the opening one or two sentences so the paragraph opens differently.

HARD RULES:
- Do NOT begin with any variation of "Your wallet called/blinked/…" or address the wallet in the first sentence.
- Preserve every fact, price, set number, and name exactly.
- Keep the rest of the paragraph intact wherever possible; total length within ±20% of the original.
- Return ONLY the full rewritten paragraph. No preamble, no markdown fences, no commentary.
${feedback ? `- Previous attempt rejected: ${feedback}. Open with a genuinely different sentence structure.` : ''}

OPENING PARAGRAPH:
${firstPara}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 500 } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim().replace(/^```\w*\n?|```$/g, '').trim();
}

function excerptFrom(body) {
  const raw = body.replace(/#{1,6}\s/g, '').replace(/\*+([^*]+)\*+/g, '$1').replace(/\s+/g, ' ').trim();
  return raw.length <= 160 ? raw : `${raw.slice(0, 156).replace(/\s+\S*$/, '')}…`;
}

const allNorms = corpus.map(r => r.norm);
const acceptedNorms = [];
let fixed = 0, skipped = 0;

for (const article of rewriteTargets) {
  const paras = String(article.content).split(/\n\n/);
  const firstPara = paras[0] ?? '';
  let accepted = null, feedback = null;

  for (let attempt = 1; attempt <= 2 && !accepted; attempt++) {
    let rewritten;
    try { rewritten = await geminiRewrite(article, firstPara, feedback); }
    catch (e) { console.error(`  Gemini error on ${article.slug}: ${e.message}`); break; }
    const norm = normalizeOpener(rewritten);
    const clash = [...allNorms.filter(n => n !== article.norm), ...acceptedNorms]
      .some(n => n.length >= 20 && similarity(norm, n) >= THRESHOLD);
    const stillTemplate = /^your wallet/i.test(rewritten.trim());
    if (norm.length >= 20 && !clash && !stillTemplate) accepted = rewritten;
    else feedback = stillTemplate ? 'still opens with the wallet template' : 'opener still >=85% similar to another article';
  }

  console.log(`\n[${article.table}] ${article.slug}`);
  console.log(`  BEFORE: ${firstPara.slice(0, 110)}…`);
  if (!accepted) { console.log('  SKIPPED — no acceptable rewrite after 2 attempts (manual pass needed)'); skipped++; continue; }
  console.log(`  AFTER : ${accepted.slice(0, 110)}…`);

  if (APPLY) {
    const newContent = [accepted, ...paras.slice(1)].join('\n\n');
    const update = { content: newContent, updated_at: new Date().toISOString() };
    // Regenerate excerpt/seo_description only if the old one was derived from para 1.
    const oldEx = (article.excerpt ?? '').slice(0, 40);
    if (oldEx && firstPara.replace(/\s+/g, ' ').includes(oldEx.replace(/\s+/g, ' ').replace(/…$/, ''))) {
      update.excerpt = excerptFrom(newContent);
      if (article.seo_description === article.excerpt) update.seo_description = update.excerpt;
    }
    const { error } = await sb.from(article.table).update(update).eq('id', article.id);
    if (error) { console.error(`  DB WRITE FAILED: ${error.message}`); skipped++; continue; }
  }
  acceptedNorms.push(normalizeOpener(accepted));
  fixed++;
  await new Promise(r => setTimeout(r, 1200)); // pace Gemini
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN'} — rewritten: ${fixed}, skipped: ${skipped}, keepers untouched: ${clusters.length}`);
if (!APPLY) console.log('Re-run with --apply to write.');
