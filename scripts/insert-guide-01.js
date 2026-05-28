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

const content = `You know that moment at a toy shop when a kid picks up a LEGO box and refuses to put it down? Your wallet already knows what happened next.

LEGO is a construction toy system made of plastic bricks that click together — and more importantly, come apart — with satisfying precision. You build things. You rebuild things. You accidentally step on a piece at 2am and question every life decision. That last part is free with every set.

The name comes from the Danish phrase leg godt — "play well." The company is Danish, founded in 1932, still family-owned, still based in Billund, Denmark. It is, by most measures, the largest toy company in the world. Your kid is not being dramatic. This stuff is genuinely good.

How does it work?

Every LEGO brick follows the same dimensional standard it has followed since 1958. A brick you bought in 1978 fits a brick you buy today. This is not an accident — it is the entire point. LEGO calls it "the System." What it means practically: nothing you buy becomes obsolete. Sets combine. Collections grow. The chaos in your living room is technically an investment in compatibility.

Sets come with numbered bags, a step-by-step instruction booklet, and exactly the pieces you need plus a few spares for the ones you will inevitably lose in the sofa. Assembly is the experience — not just the finished model. Most adults who "try it once to help the kids" do not stop.

What can you build?

Whatever you want, is the honest answer. LEGO organises its catalogue into themes:

City — cars, police stations, fire trucks. Classic starter territory.
Technic — gears, axles, working mechanisms. For people who liked engineering before they knew the word.
Creator Expert / Icons — architectural landmarks, vintage cars, the Eiffel Tower. These sit on shelves and impress guests.
Star Wars — the largest licensed theme. The reason many adults rediscovered LEGO in their thirties.
Architecture — Indian landmarks included. The Taj Mahal set (21056) exists and yes, it is worth it.
Ideas — fan-designed sets voted into production. The most interesting corner of the catalogue.

There are 30+ active themes. You will find your corner eventually.

What does LEGO cost in India?

This is the part nobody warns you about.

LEGO does not manufacture in India and has no official Indian pricing. Sets are imported, which means you are paying the US or European retail price, converted at live exchange rates, plus import duties, plus retailer margin. A set that costs $50 in the US typically lands at ₹6,000–7,500 in India depending on the store and the timing.

Three stores worth knowing: Toycra (use code ABHINAV12 for 12% off on orders above ₹500), MyBrickHouse (LEGO's only certified retail partner in India), and Jaiman Toys. Prices vary between them — sometimes significantly — which is exactly why bricksofindia.com exists.

The first LEGO certified store in India opened in May 2025 at Ambience Mall, Gurugram. Before that, every LEGO purchase in India was either online, grey market, or someone's suitcase from a foreign trip. We have come a long way. The wallet has not recovered.

Is LEGO for kids or adults?

Yes.

LEGO's own data shows roughly half its revenue now comes from adult buyers. The 18+ line exists, the "For Adults" tag on boxes is real, and sets like the Eiffel Tower (10307, 10,001 pieces) were never aimed at children. The cultural shift happened quietly and then all at once.

In India specifically, adult LEGO collecting is a growing community — active on Reddit (r/IndiaLEGO), Facebook groups, and increasingly on Instagram. If you are an adult reading this and feeling slightly self-conscious about your interest: you are not alone, you are not unusual, and the hobby is considerably cheaper than a car.

Where do you start?

One set. Pick a theme you already love — football, architecture, space, cars, whatever. Buy one set in the ₹2,000–4,000 range and build it. Everything else follows from there.

Just keep it away from your feet at night.`;

const excerpt = "You know that moment at a toy shop when a kid picks up a LEGO box and refuses to put it down? Your wallet already knows what happened next. A beginner's guide to LEGO in India — what it costs, where to buy, and why adults love it too.";

const wordCount = content.split(/\s+/).filter(Boolean).length;
const readTime  = Math.ceil(wordCount / 200);
console.log(`Word count: ${wordCount} | Read time: ${readTime} min`);

(async () => {
  const { data, error } = await sb
    .from('guides')
    .insert({
      slug:               'what-is-lego-beginners-guide-india',
      title:              "What is LEGO? A Beginner's Guide for India",
      content,
      excerpt,
      category:           'lego-101',
      read_time_minutes:  readTime,
      published_at:       new Date().toISOString(),
    })
    .select('id, slug, published_at')
    .single();

  if (error) {
    console.error('INSERT ERROR:', error.message);
    process.exit(1);
  }
  console.log('Inserted row:', JSON.stringify(data, null, 2));
})();
