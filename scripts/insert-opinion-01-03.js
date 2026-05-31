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

function ts(hoursFromNow) {
  const d = new Date();
  d.setTime(d.getTime() + hoursFromNow * 60 * 60 * 1000);
  return d.toISOString();
}

function firstSentence(text) {
  const m = text.match(/^[^.!?]+[.!?]/);
  return m ? m[0].trim() : text.slice(0, 160).trim();
}

const posts = [
  {
    slug:        'certified-store-india-charges-too-much',
    title:       'The LEGO Certified Store in India Charges Too Much and Nobody Is Saying It',
    category:    'Opinion',
    published_at: ts(0),
    content: `Everyone was so excited about the store opening that nobody stopped to check the prices.

May 2025. India's first LEGO certified store opens at Ambience Mall, Gurugram. Four thousand five hundred square feet. Pick a Brick wall. Mosaic Maker. The whole experience. Indian LEGO fans — who had spent decades sourcing sets through suitcase imports, grey market channels, and increasingly desperate Amazon searches — finally had a proper home. The photos went everywhere. The excitement was genuine. The prices were quietly ignored.

They should not be ignored any longer.

What the certified store actually charges

The LEGO certified store in India is operated by MyBrickHouse under licence from LEGO. MyBrickHouse is a legitimate, trustworthy retailer and the only source in India for certain exclusive and limited sets. None of what follows is an argument against shopping there. It is an argument for knowing what you are paying for.

A set that costs $60 at LEGO's US retail — already a premium price — lands at MyBrickHouse for ₹7,500 to ₹9,000 depending on the set. At current exchange rates, $60 is approximately ₹5,750. The difference — ₹1,750 to ₹3,250 — is import duties, logistics, and retailer margin. This is not a scam. It is arithmetic. But it is arithmetic that nobody in the certified store opening coverage bothered to do publicly.

For comparison, Toycra — a non-certified Indian LEGO retailer — frequently prices the same sets 10–20% lower than MyBrickHouse. The sets are identical. Authentic LEGO, same box, same pieces, same warranty implications. The difference is the certified store premium.

What you are actually paying for

To be fair — and fairness requires this — the certified store premium buys you real things.

Guaranteed authenticity. Physical retail experience. The Pick a Brick wall, which has genuine value for serious builders. Access to exclusive sets and promotional items that non-certified retailers cannot stock. Trained staff who know the product. The full LEGO brand experience in a way that a warehouse fulfilment operation cannot replicate.

If you are buying a ₹50,000 UCS set and want absolute certainty about authenticity and after-sales support, the certified store premium is rational. If you want the Pick a Brick experience or a set that is exclusive to certified retail, there is no alternative.

Where the argument falls apart

For the vast majority of sets, for the vast majority of Indian buyers, none of that premium matters.

A City Police Station is a City Police Station. A Technic McLaren is a Technic McLaren. The box is sealed, the pieces are LEGO, and the building experience is identical whether it came from a certified store or a competitive online retailer. Paying 15% more for the certified store label on a standard catalogue set is paying for a feeling, not a function.

The Indian LEGO community celebrated the certified store opening as a moment of arrival — proof that LEGO finally took India seriously. That celebration was earned. But arrival does not mean affordable. The certified store did not change the import economics that make LEGO expensive in India. It added a premium retail layer on top of them.

What needs to happen

LEGO needs to address Indian pricing structurally — not through retail experience but through supply chain. Manufacturing in India, or at minimum establishing true Indian RRP that accounts for local economics, would do more for Indian LEGO accessibility than any number of certified stores.

Until that conversation happens, the certified store is a beautiful shop that most Indian LEGO fans will visit occasionally for the experience and buy from rarely for the price.

Check bricksofindia.com before every purchase. MyBrickHouse and Toycra on one page. Use code ABHINAV12 at Toycra for 12% off above ₹500. The certified store is worth visiting. It is not always worth paying.

On that bombshell — the prices were always there. We just did not want to look at them on opening day.`,
  },
  {
    slug:        'lego-should-manufacture-in-india',
    title:       'LEGO Should Manufacture in India. Here Is Why They Will Not.',
    category:    'Opinion',
    published_at: ts(1),
    content: `The most important conversation about LEGO in India is not happening. Not in the community, not in the press, not apparently inside LEGO itself. Everyone is too busy celebrating the certified store.

Here is the conversation: why is a company selling to one of the world's largest and fastest-growing consumer markets still manufacturing nothing here?

The case for Indian manufacturing is obvious

India is not a small market that LEGO is politely tolerating. It is a country of 1.4 billion people with a rapidly expanding middle class, near-universal brand recognition for LEGO among urban parents, and a documented adult collector community that has been spending money on imported sets for decades despite prices that would make Western collectors blanch.

The import premium Indian buyers pay is not marginal. A set that costs $60 in the US — ₹5,750 at current rates — lands in Indian retail at ₹7,500 to ₹9,000. That 30–55% premium is the direct result of import duties and logistics costs that Indian manufacturing would eliminate or dramatically reduce. Lower prices would expand the addressable market significantly. More Indian families could afford LEGO. More Indian adults could build more sets more often. The revenue upside is not complicated arithmetic.

LEGO knows this. They are not a naive company. The certified store opening, the 50-store expansion target by 2030, the F1 sets performing at the top of Asian market rankings in 2025 — these are not the actions of a company that does not understand India's potential.

So why are they not manufacturing here

Several reasons, none of them simple.

Manufacturing precision first. LEGO's brick tolerances — 0.004mm consistency, clutch power calibrated to decades of refinement — are not easily replicated in a new facility. Every LEGO manufacturing site goes through an extended qualification process before it produces bricks that meet the standard. This is not an excuse. It is a genuine constraint. The barrier to entry for LEGO-quality manufacturing is higher than for almost any other consumer product.

Supply chain complexity second. LEGO's ABS plastic formulation, colourant sourcing, and mould tooling represent decades of accumulated expertise concentrated in facilities in Denmark, Czech Republic, Hungary, China, and Mexico. Replicating any part of that supply chain in India requires either transplanting existing expertise or building new expertise from scratch. Neither is fast or cheap.

The regulatory environment third. Indian manufacturing at scale involves navigating labour law, environmental compliance, land acquisition, and infrastructure that adds friction and timeline to any greenfield industrial project. LEGO has shown willingness to invest in manufacturing complexity — the Mexico facility took years to bring online. But the appetite for that complexity in a market that is growing but not yet their largest is a legitimate question.

The actual reason

All of the above is real. None of it is the whole story.

The whole story is that LEGO does not need to manufacture in India to sell in India. The demand exists at current prices. Indian buyers — conditioned by decades of import economics — are paying the premium and continuing to buy. The certified store is full. The online retailers are growing. The business case for absorbing the complexity and capital expenditure of Indian manufacturing does not yet close when the existing model is working.

This will change. As Indian LEGO penetration grows, as the collector base deepens, as the 50-store expansion brings more first-time buyers into the ecosystem — the volume math will eventually tip. At some point the revenue opportunity from price-competitive Indian manufacturing will outweigh the complexity cost.

That point is not 2026. It is probably not 2030. But it is coming, and when it does, the conversation everyone is not having right now will suddenly seem obvious in retrospect.

What Indian fans can do in the meantime

Exactly what they have always done. Compare prices carefully. Use every discount available. Buy with patience and intention rather than impulse.

Check bricksofindia.com before every purchase — MyBrickHouse and Toycra on one page, updated every six hours. Use code ABHINAV12 at Toycra for 12% off above ₹500. The import premium is real and it is not going away soon.

But the certified store is here. Fifty more are coming. The trajectory is right even if the pricing is not yet.

On that bombshell — LEGO should manufacture in India. They will. Just not yet. And not before your wallet suffers considerably more in the interim.`,
  },
  {
    slug:        'star-wars-lego-will-bankrupt-you',
    title:       'Star Wars and Star Trek LEGO Will Bankrupt You. I Escaped. Here\'s How.',
    category:    'Opinion',
    published_at: ts(2),
    content: `I do not collect Star Wars LEGO. My wallet has never once called to thank me, but I can tell it wants to.

Let me explain what I escaped. Because if you are currently staring at a UCS Millennium Falcon listing and wondering whether ₹75,000 is really that much money, you need to hear this from someone standing safely on the other side of the fence.

The trap is perfectly designed

Star Wars LEGO is not a hobby. It is a subscription service that forgot to tell you the price.

It works like this. You buy one set — an X-Wing, say, or a TIE Fighter. Entry level. Reasonable price. The build is excellent, the finished model looks extraordinary, and you put it on your shelf feeling entirely justified. Then you notice it looks slightly lonely up there. The X-Wing needs a context. Maybe the Death Star. Maybe just the Millennium Falcon. The Falcon leads naturally to Cloud City. Cloud City to the AT-AT. The AT-AT to the AT-ST because at this point what is another ₹8,000.

Each individual purchase is defensible. The aggregate is a financial event.

The Star Wars UCS line alone — the large scale collector sets — has released over 30 sets since 1999. At an average Indian retail price of approximately ₹25,000 per set, completing the UCS collection would cost you roughly ₹7,50,000. That is not including the standard sets, the helmets, the dioramas, the minifigure collections, or whatever new thing LEGO announces next month because they will announce something next month. They always do.

Star Trek fans have it worse in a different way — the theme is smaller, the sets are rarer, and scarcity makes the secondary market brutal. A retired Star Trek set in sealed condition commands prices that would make a UCS collector wince.

The psychology is not accidental

LEGO understands licensed IP collecting better than almost any company on earth. The sets are designed to be displayed together. The scenes reference each other. The minifigures from one set appear in the background of another. The whole line is architecturally coherent in a way that makes completionism feel not like a compulsion but like good taste.

It is not good taste. It is a very well-designed commercial ecosystem.

New sets retire. Retired sets appreciate. The fear of missing out on a set at retail — knowing that in three years it will cost double on the secondary market — is a real and rational anxiety that the collecting community has thoroughly internalised. LEGO did not manufacture that anxiety deliberately. But they have certainly not done anything to reduce it.

How I escaped

I got lucky, honestly. My collecting instincts ran toward Technic and Icons — themes where the catalogue is large, the sets are not narratively connected to each other, and completionism is not really the point. Nobody feels compelled to own every Technic set because Technic sets do not form a coherent universe. They are individual engineering achievements. You buy the ones that interest you and feel no guilt about the ones you skip.

The psychological architecture is completely different. One less lever pulling at your wallet.

If you are already deep in Star Wars collecting, I am not suggesting you stop. The sets are genuinely excellent. The community is wonderful. The builds are among the best LEGO produces. But go in with a clear annual budget, a firm list of sets you actually want rather than sets you feel you should have, and the discipline to let retiring sets retire without chasing them into the secondary market at double the price.

Your wallet is not bottomless. Neither is the Death Star, technically, but LEGO keeps rebuilding it.

Check bricksofindia.com for live Indian prices before any Star Wars purchase. MyBrickHouse and Toycra on one page. Use code ABHINAV12 at Toycra for 12% off above ₹500. Buy the sets you love. Skip the ones you feel obligated to own.

On that bombshell — the Falcon is beautiful. It will also cost you ₹75,000. You have been warned.`,
  },
];

(async () => {
  console.log(`Inserting ${posts.length} opinion posts...\n`);
  let ok = 0;

  for (const p of posts) {
    const excerpt = firstSentence(p.content);
    const { data, error } = await sb
      .from('blog_posts')
      .insert({
        slug:         p.slug,
        title:        p.title,
        content:      p.content,
        excerpt,
        category:     p.category,
        published_at: p.published_at,
        seo_title:    p.title,
        seo_description: excerpt,
      })
      .select('id, slug, published_at')
      .single();

    if (error) {
      console.error(`FAIL  ${p.slug}: ${error.message}`);
    } else {
      console.log(`OK    id=${data.id}  ${data.slug}  ${data.published_at}`);
      ok++;
    }
  }

  console.log(`\nInserted: ${ok}/${posts.length}`);

  // Final count
  const { count } = await sb.from('blog_posts').select('*', { count: 'exact', head: true });
  console.log(`Total blog_posts rows: ${count}`);

  // Opinion-only count
  const { count: opCount } = await sb.from('blog_posts').select('*', { count: 'exact', head: true }).eq('category', 'Opinion');
  console.log(`Opinion rows: ${opCount}`);
})();
