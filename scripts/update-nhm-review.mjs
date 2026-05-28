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
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
} catch {}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const REVIEW_ID = '70db543d-ae1e-42c9-849b-b105c4ae15c5';

const newContent = `Every few months, something happens in Indian LEGO retail that makes me want to sit down and have a quiet word with whoever is responsible for pricing decisions. Three Indian stores currently stock the LEGO Icons Natural History Museum. Jaiman Toys: ₹26,990. MyBrickHouse: ₹31,999. Toycra: ₹34,999. The spread between cheapest and most expensive is ₹8,009. That number should be in your head before we discuss anything else about this set.

The Natural History Museum (10326) is a 4,015-piece Modular Buildings entry. It is beautiful. It is not worth ₹34,999 right now, and I will not pretend otherwise.

THE SET

The Natural History Museum recreates the grand Victorian facade of a natural history institution — soaring arched windows, ornate stonework, a cathedral-like entrance hall with a tiled floor. Inside: a fossil display case, a dinosaur skeleton dominating the great hall, a reading room on the upper floor, and a rooftop observatory with a working telescope detail. At 4,015 pieces, it is a full Modular Buildings entry and architecturally one of the more ambitious ones in recent years. The colour scheme — cream, light grey, dark tan — is serious and accurate and exactly what this building should look like.

The build takes 12–16 hours at a comfortable pace and has the satisfying cadence that distinguishes all Modular Buildings sets: section by section, floor by floor, the museum assembles itself in recognisable stages, each one feeling like a small completion before joining the whole. The interior detail is consistent throughout. This is a high-quality LEGO set. The problem is not the set.

THE INDIA QUESTION

<!-- INDIA_PARAGRAPH -->
Jaiman Toys: ₹26,990. MyBrickHouse: ₹31,999. Toycra: ₹34,999. Import duty does not apply — this set is officially stocked in India. MyBrickHouse is ₹5,009 above Jaiman; Toycra is ₹8,009 above Jaiman — roughly 30% premium on an already large number. In Indian terms: ₹8,009 is 14 plates of butter chicken, three months of a mid-range EMI on something that actually appreciates in value, or a perfectly good return train ticket to somewhere worth going. The issue is purely retailer margin, and retailer margin is not your problem to solve with your money.

WHAT IT SHOULD COST

At Jaiman's ₹26,990 — ₹6.72 per piece, 4,015 pieces of excellent Victorian architecture — the verdict changes completely: buy without hesitation. If you need to buy from MyBrickHouse or Toycra, wait for a sale. Both run periodic discounts on the Modular range. Modular Buildings sets do not disappear from shelves overnight. The patience required is modest. ₹8,009 is not a trivial sum in any accounting system that takes LEGO prices seriously, and this one does.

THE VERDICT

4,015 pieces of Victorian architecture executed with real conviction. A set that earns a BUY at Jaiman's ₹26,990 and a firm WAIT FOR SALE at ₹31,999–₹34,999. The premium at MyBrickHouse and Toycra benefits the retailer and no one else. Set a price alert. Check back monthly. When a sale brings either store closer to ₹26,990 — and it will — buy it immediately. On that bombshell, your wallet has enough sense to wait even when you don't.`;

console.log('Updating NHM review...');
const { error } = await sb
  .from('reviews')
  .update({ content: newContent })
  .eq('id', REVIEW_ID);

if (error) {
  console.error('UPDATE FAILED:', error.message);
  process.exit(1);
}
console.log('Done. Verifying ₹ mentions in updated content:');
const prices = [...newContent.matchAll(/₹[\d,]+/g)].map(m => m[0]);
console.log(prices);
console.log('\nNo ₹27,000 remaining:', !newContent.includes('₹27,000'));
