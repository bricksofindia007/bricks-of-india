/**
 * Day 33 content + DB fixes.
 * Handles: NHM verdict, content integrity issues 6/7/8/9
 *
 * Fix 3: NHM review verdict "WAIT FOR SALE" → "WAIT"
 * Fix 6: Strip ** markdown from lego-best-gifts-kids-india-2026
 * Fix 7: Inject ABHINAV12 into India Paragraph of lego-11380-road-bike
 * Fix 8: Fix ALL CAPS word in Netherlands train article
 * Fix 9: Set hero_image on lego-11380-road-bike (Rebrickable fallback)
 *
 * Run: node --env-file=.env.local scripts/fix-day33-issues.mjs
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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const UA = 'BricksOfIndia-Fix/1.0 (+https://bricksofindia.com)';

// ── Fix 3: NHM review verdict ──────────────────────────────────────────────────

console.log('\n── Fix 3: NHM review verdict ──');
{
  const { data: nhm, error } = await sb
    .from('reviews')
    .select('id, verdict, title')
    .eq('slug', 'lego-10326-natural-history-museum-review')
    .maybeSingle();

  if (error) {
    console.log(`  ERROR: ${error.message}`);
  } else if (!nhm) {
    console.log('  SKIP: review not found');
  } else if (nhm.verdict === 'WAIT') {
    console.log(`  OK: verdict already 'WAIT'`);
  } else {
    console.log(`  Current verdict: "${nhm.verdict}" → patching to "WAIT"`);
    const { error: upErr } = await sb
      .from('reviews')
      .update({ verdict: 'WAIT' })
      .eq('id', nhm.id);
    if (upErr) console.log(`  FAIL: ${upErr.message}`);
    else console.log('  ✓ Updated');
  }
}

// ── Fix 6: Strip ** markdown from best-gifts article ──────────────────────────

console.log('\n── Fix 6: Strip ** from lego-best-gifts-kids-india-2026 ──');
{
  const { data: article, error } = await sb
    .from('news_articles')
    .select('id, content, title')
    .eq('slug', 'lego-best-gifts-kids-india-2026')
    .maybeSingle();

  if (error) {
    console.log(`  ERROR: ${error.message}`);
  } else if (!article) {
    // Try variant slugs
    const { data: articles } = await sb
      .from('news_articles')
      .select('id, content, title, slug')
      .ilike('slug', '%gifts%kids%india%');
    if ((articles ?? []).length === 0) {
      console.log('  SKIP: article not found (slug may differ)');
    } else {
      for (const a of articles) {
        console.log(`  Found: ${a.slug}`);
        const fixed = a.content.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
        const { error: upErr } = await sb.from('news_articles').update({ content: fixed }).eq('id', a.id);
        if (upErr) console.log(`  FAIL: ${upErr.message}`);
        else console.log(`  ✓ Stripped markdown asterisks from ${a.slug}`);
      }
    }
  } else {
    const orig = article.content;
    const fixed = orig.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
    if (fixed === orig) {
      console.log('  OK: no markdown asterisks found');
    } else {
      const instances = (orig.match(/\*{1,3}[^*]+\*{1,3}/g) ?? []).length;
      console.log(`  Stripping ${instances} bold/italic markdown instance(s)`);
      const { error: upErr } = await sb.from('news_articles').update({ content: fixed }).eq('id', article.id);
      if (upErr) console.log(`  FAIL: ${upErr.message}`);
      else console.log('  ✓ Updated');
    }
  }
}

// ── Fix 7 + 9: Road bike — ABHINAV12 + hero_image ────────────────────────────

console.log('\n── Fix 7 + 9: lego-11380-road-bike — ABHINAV12 + hero_image ──');
{
  const { data: article, error } = await sb
    .from('news_articles')
    .select('id, content, title, hero_image')
    .eq('slug', 'lego-11380-road-bike')
    .maybeSingle();

  if (error) {
    console.log(`  ERROR: ${error.message}`);
  } else if (!article) {
    console.log('  SKIP: article not found');
  } else {
    const updates = {};

    // Fix 7: ABHINAV12 injection
    const indiaIdx = article.content.indexOf('Toycra');
    if (indiaIdx === -1) {
      console.log('  Fix 7: Toycra mention not found — cannot auto-inject ABHINAV12');
    } else if (/ABHINAV12/i.test(article.content)) {
      console.log('  Fix 7: ABHINAV12 already present');
    } else {
      // Find first Toycra mention and append affiliate note sentence after that paragraph
      const AFFILIATE_SENTENCE = 'Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.';
      // Find the paragraph containing Toycra and append if not already there
      const lines = article.content.split('\n');
      let injected = false;
      const fixedLines = lines.map(line => {
        if (!injected && /Toycra/i.test(line) && !/ABHINAV12/i.test(line)) {
          injected = true;
          return line + ' ' + AFFILIATE_SENTENCE;
        }
        return line;
      });
      if (injected) {
        updates.content = fixedLines.join('\n');
        console.log('  Fix 7: ✓ Injected ABHINAV12 affiliate sentence');
      } else {
        console.log('  Fix 7: could not inject — paragraph structure unclear');
      }
    }

    // Fix 9: hero_image — fetch from Rebrickable
    if (article.hero_image) {
      console.log(`  Fix 9: hero_image already set (${article.hero_image.slice(0, 60)})`);
    } else {
      console.log('  Fix 9: fetching Rebrickable image for set 11380-1...');
      try {
        const rbKey = process.env.REBRICKABLE_API_KEY;
        const headers = { 'User-Agent': UA, ...(rbKey ? { Authorization: `key ${rbKey}` } : {}) };
        const res = await fetch('https://rebrickable.com/api/v3/lego/sets/11380-1/', {
          headers,
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          console.log(`  Fix 9: Rebrickable returned ${res.status} — hero_image not set`);
        } else {
          const data = await res.json();
          if (data.set_img_url) {
            updates.hero_image = data.set_img_url;
            console.log(`  Fix 9: ✓ Got image: ${data.set_img_url.slice(0, 70)}`);
          } else {
            console.log('  Fix 9: Rebrickable returned no set_img_url');
          }
        }
      } catch (e) {
        console.log(`  Fix 9: Rebrickable fetch error: ${e.message}`);
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await sb.from('news_articles').update(updates).eq('id', article.id);
      if (upErr) console.log(`  FAIL: ${upErr.message}`);
      else console.log(`  ✓ Saved ${Object.keys(updates).join(' + ')}`);
    } else {
      console.log('  No changes needed');
    }
  }
}

// ── Fix 8: ALL CAPS in Netherlands train article ───────────────────────────────

console.log('\n── Fix 8: ALL CAPS in Netherlands train article ──');
{
  // Find articles with "netherlands" and "train" in slug or title
  const { data: articles } = await sb
    .from('news_articles')
    .select('id, content, title, slug')
    .or('slug.ilike.%netherlands%,title.ilike.%netherlands%,slug.ilike.%dutch%,title.ilike.%dutch%');

  if ((articles ?? []).length === 0) {
    console.log('  SKIP: no Netherlands/Dutch article found');
  } else {
    for (const a of articles) {
      console.log(`  Checking: ${a.slug}`);
      // Find ALL CAPS words (3+ chars) that aren't LEGO, BOI, or known acronyms
      const ALLOWED_CAPS = new Set(['LEGO', 'BOI', 'MRP', 'OG', 'TBD', 'DIY', 'FAQ', 'URL', 'API', 'UI']);
      const capsMatches = [];
      const wordRe = /\b([A-Z]{3,})\b/g;
      let m;
      while ((m = wordRe.exec(a.content)) !== null) {
        if (!ALLOWED_CAPS.has(m[1])) capsMatches.push(m[1]);
      }
      if (capsMatches.length === 0) {
        console.log('  OK: no unexpected ALL CAPS words');
        continue;
      }
      console.log(`  Found ALL CAPS: ${[...new Set(capsMatches)].join(', ')}`);
      // Title-case the offending words (not LEGO or known acronyms)
      let fixed = a.content;
      for (const word of new Set(capsMatches)) {
        const titled = word[0] + word.slice(1).toLowerCase();
        fixed = fixed.replace(new RegExp(`\\b${word}\\b`, 'g'), titled);
      }
      const { error: upErr } = await sb.from('news_articles').update({ content: fixed }).eq('id', a.id);
      if (upErr) console.log(`  FAIL: ${upErr.message}`);
      else console.log(`  ✓ Fixed ALL CAPS in ${a.slug}`);
    }
  }
}

console.log('\n── All done ──');
