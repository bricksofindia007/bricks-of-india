'use strict';
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const eq = line.indexOf('=');
  if (eq === -1 || line.trim().startsWith('#')) continue;
  env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function firstSentence(text) {
  const m = text.match(/^[^.!?]+[.!?]/);
  return m ? m[0].trim() : text.slice(0, 160).trim();
}

const content = `The LEGO Eiffel Tower is leaving. July 31 2026 is the confirmed exit date — which means Indian buyers have approximately 64 days to decide whether ₹65,999 is a reasonable price for 10,001 pieces and nearly five feet of Parisian engineering in plastic.

Spoiler: it kind of is. Just not for everyone.

What you are buying

Set 10307 is one of LEGO's most ambitious Icons builds. 10,001 pieces. 149cm tall at completion. Four floors with working elevators, observation platforms, and enough detail that guests will stop and actually look at it. The build takes 15–20 hours across multiple sessions. The finished model dominates any room it occupies.

It launched globally in November 2022. India got it on the usual 4–6 week lag. It has been available at MyBrickHouse and occasionally Toycra ever since. July 31 is when that ends.

The India price reality

Right now MyBrickHouse has it at ₹65,999. That is the most reliable Indian price and the one to reference. For context — ₹65,999 is 18 months of Spotify Premium Family Plan, or roughly what a decent office chair costs. Not a casual purchase. An intentional one.

Once it retires, sealed copies on the secondary market will start climbing. Sets of this scale and profile historically hit 150–200% of retail within two to three years of retirement. The ₹65,999 you spend today may look reasonable in 2028. Or you build it and it lives on your wall and that is the point entirely.

Verdict: BUY NOW — if you have been considering it

This is not a set that goes on surprise sale before retirement. LEGO flagship Icons sets do not get discounted. The price today is the price until July 31, and then it is gone.

If the Eiffel Tower has been on your list — and for Indian LEGO collectors it absolutely should have been — the time is now. Not next month. Now.

Check live prices at bricksofindia.com. MyBrickHouse has stock. Use code ABHINAV12 at Toycra for 12% off above ₹500 if they have it listed.

On that bombshell — 64 days. Your move.`;

const article = {
  slug:         'lego-eiffel-tower-10307-retiring-india',
  title:        'LEGO Eiffel Tower (10307) Is Retiring in India — and It Costs ₹65,999',
  category:     'News',
  published_at: new Date().toISOString(),
  content,
  excerpt:      firstSentence(content),
  seo_title:    'LEGO Eiffel Tower (10307) Is Retiring in India — and It Costs ₹65,999',
  seo_description: 'LEGO set 10307 Eiffel Tower retires 31 July 2026. 10,001 pieces, ₹65,999 at MyBrickHouse. Buy now before it\'s gone.',
};

(async () => {
  const { data, error } = await sb
    .from('news_articles')
    .insert(article)
    .select('id, slug, published_at')
    .single();

  if (error) {
    console.error('FAIL:', error.message);
    process.exit(1);
  }
  console.log(`OK  id=${data.id}  slug=${data.slug}  published_at=${data.published_at}`);

  const { count } = await sb.from('news_articles').select('*', { count: 'exact', head: true });
  console.log(`Total news_articles: ${count}`);
})();
