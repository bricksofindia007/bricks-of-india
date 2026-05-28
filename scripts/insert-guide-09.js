'use strict';
const { createClient } = require('@supabase/supabase-js');

const fs = require('fs');
const envRaw = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  const eq = line.indexOf('=');
  if (eq === -1 || line.trim().startsWith('#')) continue;
  env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const content = `For most of its history in India, LEGO was not really here. It was present the way an expensive relative is present — occasionally, at significant cost, and always through someone else's effort. You knew it existed. Getting your hands on it was another matter entirely.

This is the story of how one of the world's most beloved toy brands spent decades treating the world's most populous country as an afterthought, and what finally changed.

The grey market years: 1980s–2010s

LEGO sets arrived in India long before LEGO India did. The mechanism was informal and entirely demand-driven: travellers bringing sets back in suitcases, relatives posting boxes from abroad, the occasional import shop in a major city stocking a handful of sets at prices that reflected the effort involved. A set that cost $30 in the US might appear in Mumbai for ₹3,000–4,000 in the early 2000s — at exchange rates that made the premium brutal.

The official distribution picture was not much better. For a period, LEGO products were distributed in India through Funskool — the Indian toy company better known for its Hasbro partnership. The arrangement made LEGO nominally available in organised retail. The reality was patchy stock, limited theme selection, and prices that still reflected the import economics underneath. If you wanted a specific set, you were often still relying on someone with a foreign travel itinerary.

Online retail changed the equation somewhat. Flipkart and Amazon India brought LEGO into the organised e-commerce market in the early 2010s, making it findable and deliverable across India. But the fundamental problem remained: no Indian manufacturing, no Indian pricing, no official LEGO presence making decisions with the Indian market in mind. The prices were what they were. The stock was what importers decided to bring in. The catalogue was a fraction of what was available globally.

For Indian LEGO fans during this era, the experience was one of perpetual approximation. You could get LEGO in India. You just could not get LEGO in India the way someone in London or Singapore could.

The community builds before the brand does

Something worth noting about this period: while LEGO the company was largely absent, Indian LEGO fans were not waiting around.

The AFOL — Adult Fan of LEGO — community in India grew quietly but steadily through the 2010s. Facebook groups, later Reddit's r/IndiaLEGO, WhatsApp communities. Collectors sharing import sources, group buys to split shipping costs, display events in major cities. The passion for the hobby existed independently of any official infrastructure to support it.

This matters because it means LEGO India did not create the Indian LEGO community. It arrived to find one already waiting.

The first certified store: May 2025

On May 23, 2025, LEGO opened its first certified store in India at Ambience Mall, Gurugram. The store spans 4,500 square feet — the largest LEGO certified store in South Asia at opening. The retail partner is Ample Group, one of India's established premium retail operators.

This was not a soft launch. A 4,500 square foot flagship in one of Delhi NCR's premier shopping destinations is a statement of intent. The store carries the full certified store experience — Pick a Brick wall, Mosaic Maker, exclusive sets, trained staff, the complete LEGO retail environment that fans in other markets had taken for granted for years.

For anyone who spent the previous decade sourcing sets through grey market channels and suitcase imports, walking into that store was a specific kind of feeling. Validation, mostly. And probably some complicated emotions about the prices.

What certified means — and what it does not

A LEGO certified store is not owned by LEGO. It is operated by a licensed retail partner — in this case Ample Group — under LEGO's retail standards. The partnership guarantees authentic product, trained staff, the full brand experience, and access to exclusive and limited sets that general retail does not carry.

What it does not guarantee is cheaper prices. The import economics have not changed. Sets in the Gurugram certified store are priced at or near the top of the Indian market — you are paying for authenticity, experience, and access. MyBrickHouse, which operates the certified store, remains the most reliable source for verified authentic LEGO in India and the price reference point that bricksofindia.com uses as its primary benchmark.

Where India stands now

One certified store is a beginning, not an arrival. LEGO's stated target is 50 stores across India by 2030 — an aggressive expansion plan that would put certified retail within reach of consumers in every major Indian city.

The demand is there. India's middle class is large, growing, and increasingly willing to spend on premium leisure products. The LEGO brand has near-universal recognition among urban Indian parents and a rapidly growing adult collector base. The F1 Technic sets were among LEGO's top-performing products across Asian markets in 2025 — a data point that reflects both the global F1 boom and India's specific enthusiasm for the sport since the Lewis Hamilton and the grid expansion conversation began.

The infrastructure is catching up. Beyond the Gurugram flagship, LEGO products are now available through organised retail across India in a way that simply did not exist ten years ago. Toycra, MyBrickHouse online, and Jaiman Toys serve collectors nationwide. Prices are still import-premium. The catalogue is still subject to the 4–6 week lag from global launches. But the gap between the Indian LEGO experience and the global one is closing.

What has not changed

The price. That has not changed.

A set that costs $60 in the US still lands in India at ₹7,500–9,000. The certified store did not alter the import arithmetic. Official retail presence does not mean Indian manufacturing, Indian pricing, or parity with Western markets. That conversation — about whether LEGO will ever manufacture in India or establish true Indian pricing — has not started publicly.

Until it does, Indian LEGO fans do what they have always done: compare prices carefully, use every discount available, and buy with the considered patience of people who have been navigating import economics their entire collecting lives.

Use code ABHINAV12 at Toycra for 12% off on orders above ₹500. Check bricksofindia.com for live prices across MyBrickHouse, Toycra, and Jaiman Toys before any significant purchase. The grey market era is over. The price comparison era is very much ongoing.

Your wallet has been training for this its entire life.`;

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function excerpt(text) {
  const target = 200;
  if (text.length <= target) return text;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  let result = '';
  for (const s of sentences) {
    if ((result + s).length > target) break;
    result += s;
  }
  return result.trim() || text.slice(0, target).trim();
}

const wc       = wordCount(content);
const readTime = Math.ceil(wc / 200);
const ex       = excerpt(content);

console.log(`Word count: ${wc} | Read time: ${readTime} min`);
console.log(`Excerpt: ${ex}`);

(async () => {
  const { data, error } = await sb
    .from('guides')
    .insert({
      slug:              'history-of-lego-in-india',
      title:             'The History of LEGO in India: From Grey Market to Certified Stores',
      content,
      excerpt:           ex,
      category:          'lego-101',
      read_time_minutes: readTime,
      published_at:      new Date().toISOString(),
    })
    .select('id, slug, published_at')
    .single();

  if (error) {
    console.error('INSERT ERROR:', error.message);
    process.exit(1);
  }
  console.log('Inserted:', JSON.stringify(data, null, 2));

  const { data: all, error: countErr } = await sb
    .from('guides')
    .select('id, slug, published_at')
    .order('id', { ascending: true });

  if (countErr) { console.error('Count query error:', countErr.message); return; }
  console.log(`\nTotal rows: ${all.length}`);
  for (const r of all) console.log(`  ${r.id}  ${r.slug}  ${r.published_at}`);
})();
