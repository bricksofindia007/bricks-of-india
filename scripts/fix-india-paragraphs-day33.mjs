/**
 * Fix India Paragraphs + Love Birds verdict — Day 33
 *
 * creator-2026 : inject actual set prices (31150/31151/31152), add MyBrickHouse,
 *                raise word count above 300
 * ideas-2026   : inject actual set prices (21365/21367), remove "Amazon India"
 * love-birds   : add Toycra "check availability" + ABHINAV12, fix "VERDICT: BUY" → "Verdict: BUY NOW."
 *
 * Run: node --env-file=.env.local scripts/fix-india-paragraphs-day33.mjs
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

function wc(s) { return s.split(/\s+/).filter(Boolean).length; }

// ── 1. lego-creator-2026-india ────────────────────────────────────────────────
console.log('\n── Fix: lego-creator-2026-india ──');
{
  const { data: a } = await sb.from('news_articles').select('id,content').eq('slug','lego-creator-2026-india').maybeSingle();
  if (!a) { console.log('  NOT FOUND'); }
  else {
    // Replace the weak generic India line with priced, dual-store paragraph.
    // Prices from store_prices (live): 31152 MBH ₹4,549 / Toycra ₹4,999
    //   31150 MBH ₹5,949 / Toycra ₹6,499  |  31151 MBH ₹6,399 / Toycra ₹6,999
    const OLD = 'Use code ABHINAV12 at Toycra for 12% off any Creator purchase.';
    const NEW = `In India, Creator 3-in-1 sets are live right now at both MyBrickHouse and Toycra. The Space Astronaut (31152) is the cheapest entry point — ₹4,549 at MyBrickHouse, ₹4,999 at Toycra. The Wild Safari Animals (31150) runs ₹5,949 (MyBrickHouse) / ₹6,499 (Toycra), and the T-Rex Dinosaur (31151) is ₹6,399 (MyBrickHouse) / ₹6,999 (Toycra). At that price, the T-Rex costs roughly the same as two months of Spotify Premium Family — not life-changing money for a three-in-one build. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.`;

    if (!a.content.includes(OLD)) {
      console.log('  SKIP: anchor text not found — content may have changed');
    } else {
      const fixed = a.content.replace(OLD, NEW);
      console.log(`  Word count: ${wc(a.content)} → ${wc(fixed)}`);
      const { error } = await sb.from('news_articles').update({ content: fixed }).eq('id', a.id);
      if (error) console.log('  FAIL:', error.message);
      else console.log('  ✓ Updated (prices + MyBrickHouse added)');
    }
  }
}

// ── 2. lego-ideas-2026-india ──────────────────────────────────────────────────
console.log('\n── Fix: lego-ideas-2026-india ──');
{
  const { data: a } = await sb.from('news_articles').select('id,content').eq('slug','lego-ideas-2026-india').maybeSingle();
  if (!a) { console.log('  NOT FOUND'); }
  else {
    // Replace the "Amazon India" generic block with priced, dual-store paragraph.
    // Prices: 21367 Tintin Toycra ₹16,499 / MBH ₹16,999  |  21365 MBH ₹5,499 (Toycra: check)
    const OLD = 'Toycra and Amazon India are the most reliable sources.\n\nUse code ABHINAV12 at Toycra for 12% off any Ideas purchase.';
    const NEW = `In India, the 2026 Ideas line is available at MyBrickHouse and Toycra. The Love Birds (21365) is at MyBrickHouse for ₹5,499 — check Toycra for availability. The Tintin Moon Rocket (21367) is ₹16,499 at Toycra and ₹16,999 at MyBrickHouse. At ₹16,499, the Tintin set costs roughly 11 months of Netflix Premium India — a proper splurge, but Ideas sets retire without announcement, often without warning. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.`;

    if (!a.content.includes(OLD)) {
      // Try a softer match (line endings may differ)
      const OLD_SOFT = 'Toycra and Amazon India are the most reliable sources.';
      const idx = a.content.indexOf(OLD_SOFT);
      if (idx === -1) {
        console.log('  SKIP: neither anchor found — dumping relevant section:');
        const ti = a.content.indexOf('Toycra');
        console.log('  ' + a.content.slice(Math.max(0, ti-50), ti+300));
      } else {
        // Replace from OLD_SOFT through end of ABHINAV12 line
        const endSearch = 'Use code ABHINAV12 at Toycra for 12% off any Ideas purchase.';
        const endIdx = a.content.indexOf(endSearch, idx);
        if (endIdx === -1) {
          console.log('  SKIP: ABHINAV12 end anchor not found');
        } else {
          const replaceTarget = a.content.slice(idx, endIdx + endSearch.length);
          const fixed = a.content.replace(replaceTarget, NEW);
          console.log(`  Word count: ${wc(a.content)} → ${wc(fixed)}`);
          const { error } = await sb.from('news_articles').update({ content: fixed }).eq('id', a.id);
          if (error) console.log('  FAIL:', error.message);
          else console.log('  ✓ Updated (real prices, Amazon removed)');
        }
      }
    } else {
      const fixed = a.content.replace(OLD, NEW);
      console.log(`  Word count: ${wc(a.content)} → ${wc(fixed)}`);
      const { error } = await sb.from('news_articles').update({ content: fixed }).eq('id', a.id);
      if (error) console.log('  FAIL:', error.message);
      else console.log('  ✓ Updated (real prices, Amazon removed)');
    }
  }
}

// ── 3. lego-ideas-21365-love-birds ───────────────────────────────────────────
console.log('\n── Fix: lego-ideas-21365-love-birds ──');
{
  const SLUG = 'lego-ideas-21365-love-birds-cute-but-does-it-make-sense-for-';
  const { data: a } = await sb.from('news_articles').select('id,content').eq('slug', SLUG).maybeSingle();
  if (!a) { console.log('  NOT FOUND'); }
  else {
    let content = a.content;
    let changed = false;

    // Fix a: add Toycra + ABHINAV12 after the MBH price sentence
    if (!/Toycra/i.test(content)) {
      // Inject after "MyBrickHouse for ₹5,499." — add Toycra check + ABHINAV12
      const MBH_SENTENCE = 'available at MyBrickHouse for ₹5,499.';
      if (content.includes(MBH_SENTENCE)) {
        content = content.replace(
          MBH_SENTENCE,
          MBH_SENTENCE + ' Toycra does not currently list this set — check back or use code ABHINAV12 for 12% off on orders above ₹500 when it arrives.',
        );
        changed = true;
        console.log('  ✓ Added Toycra availability note + ABHINAV12');
      } else {
        console.log('  WARN: MBH anchor not found for Toycra injection');
      }
    } else {
      console.log('  Toycra already present');
    }

    // Fix b: "VERDICT: BUY" → "Verdict: BUY NOW."
    if (content.includes('VERDICT: BUY\n')) {
      content = content.replace('VERDICT: BUY\n', 'Verdict: BUY NOW.\n');
      changed = true;
      console.log('  ✓ Fixed verdict: VERDICT: BUY → Verdict: BUY NOW.');
    } else if (content.includes('VERDICT: BUY')) {
      content = content.replace('VERDICT: BUY', 'Verdict: BUY NOW.');
      changed = true;
      console.log('  ✓ Fixed verdict (inline)');
    } else {
      console.log('  Verdict already correct (or not found)');
    }

    if (changed) {
      const { error } = await sb.from('news_articles').update({ content }).eq('id', a.id);
      if (error) console.log('  FAIL:', error.message);
      else console.log(`  ✓ Saved (word count: ${wc(content)})`);
    } else {
      console.log('  No changes needed');
    }
  }
}

console.log('\n── All done ──');
