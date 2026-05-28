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

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function excerpt(text) {
  const clean = text.replace(/\n+/g, ' ').trim();
  if (clean.length <= 200) return clean;
  const cut = clean.slice(0, 200);
  const last = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return last > 80 ? cut.slice(0, last + 1) : cut.slice(0, 197) + '...';
}

function ts(hoursFromNow) {
  const d = new Date();
  d.setTime(d.getTime() + hoursFromNow * 3_600_000);
  return d.toISOString();
}

// ── Guide bodies ──────────────────────────────────────────────────────────────

const guides = [
  {
    slug: 'how-to-buy-lego-india',
    title: 'How to Buy LEGO in India Without Getting Ripped Off',
    category: 'lego-101',
    published_at: ts(0),
    content: `Someone in your office paid ₹8,500 for a set that was sitting on Toycra for ₹6,200. They will never know. This guide exists so that does not happen to you.

Buying LEGO in India is not complicated, but it does reward people who know two or three things that nobody bothers to explain. Here they are.

There is no official LEGO India pricing

This is the root of all confusion. LEGO does not manufacture in India and until very recently had no official retail presence here. Every set you buy in India has been imported — which means the price you see is a function of the US or European retail price, the current dollar-rupee exchange rate, import duties, and whatever margin the retailer decides to add.

The result: the same set can vary by 20–40% between stores on the same day. This is normal. It is not a scam. It just means you should check more than one place before buying.

The three stores worth knowing

MyBrickHouse is LEGO's only certified retail partner in India. They opened India's first LEGO certified store at Ambience Mall, Gurugram in May 2025. Their prices are typically at or near the top of the market — you are paying for authenticity guarantee, physical retail experience, and official warranty. Worth it for big purchases. Not always the cheapest.

Toycra is the most price-competitive of the three for most sets. They run regular sales, and if you use code ABHINAV12 you get 12% off on orders above ₹500. That discount alone can save you ₹500–2,000 on a mid-range set. Bookmark this one.

Jaiman Toys tends to price at or near MRP. Useful as a reference point and sometimes the only store with stock on older or less common sets.

That is the entire trustworthy Indian LEGO retail market right now. Three stores. Check all three before buying anything above ₹3,000.

What about Amazon and Flipkart?

Complicated answer. Both platforms have genuine LEGO listings — and also third-party sellers who are either overpricing, selling old stock, or occasionally selling non-genuine product. The risk is not huge but it is real. If you buy from Amazon or Flipkart, buy from the LEGO-branded storefront or a seller with thousands of reviews and a clear returns policy. Never buy a sealed LEGO set from a seller with fewer than 50 reviews.

For anything above ₹5,000, stick to the three stores above. The price difference rarely justifies the risk.

Grey market: the honest answer

Grey market means sets brought in through unofficial import channels — typically someone buying in bulk abroad and selling in India. Prices can be 15–25% lower than retail. The sets are genuine LEGO. The risk: no warranty, no returns, and if something is missing from the box you have no recourse. For display sets you will never disassemble, it is a reasonable trade-off. For sets you plan to build with children, buy from a verified retailer.

When to buy

LEGO sets in India do not go on sale as predictably as electronics. But there are patterns worth knowing:

Sales happen around Diwali, Christmas, and occasionally Republic Day. Toycra runs flash sales with less predictability — worth following their Instagram or subscribing to deal alerts. Sets that are about to retire occasionally get discounted; bricksofindia.com tracks retiring sets so you know when to move.

New sets typically arrive in Indian stores 4–6 weeks after global launch. If you are seeing a set announced online and cannot find it in India yet, wait. It is coming. Importing it the week of launch saves you almost nothing and costs you warranty and returns protection.

The one rule that covers everything

Check bricksofindia.com before buying anything. All three store prices on one page, updated regularly. If MBH is cheapest, buy from MBH. If Toycra is cheapest, use ABHINAV12 and make it cheaper still. Five minutes of comparison saves you more than the effort costs.

Your wallet has been through enough.`,
  },
  {
    slug: 'lego-themes-explained-india',
    title: 'LEGO Themes Explained: Which One is Right for You?',
    category: 'lego-101',
    published_at: ts(1),
    content: `Walk into a toy shop with a LEGO section and you will understand the problem immediately. There are forty boxes, twelve different colours, five different age ranges, and absolutely no logical starting point. Your wallet is confused. So are you.

LEGO organises its entire catalogue into themes — essentially product lines, each with its own visual identity, target audience, and price range. Knowing which theme fits you (or whoever you are buying for) is the difference between a set that gets built once and forgotten, and one that starts an entirely unreasonable hobby.

Here are the ones that matter for Indian buyers.

City

The most recognisable theme. Police stations, fire trucks, ambulances, construction sites, the occasional space mission. Sets range from ₹800 to ₹8,000. Designed for ages 5–12 but genuinely fun for adults doing a casual build. Best entry point for children who want something immediately recognisable. If you are buying for a child under 10 and have no idea where to start, buy a City set. You cannot go wrong.

Technic

Gears, axles, pneumatics, working differentials. Technic sets do things — doors open, engines move, suspensions compress. The engineering logic is real and the builds are complex. Entry-level sets start around ₹1,500. The flagship sets — McLaren, Bugatti, Land Rover — sit at ₹15,000 to ₹50,000+. For teenagers who like how things work, or adults who liked engineering before they knew the word. Not for children under 8; the pieces are small and the instructions unforgiving.

Icons (formerly Creator Expert)

Landmark buildings, vintage cars, botanical collections. The Eiffel Tower. The Taj Mahal. A 1989 Batmobile. A bouquet of flowers that never dies. These are display sets — you build them, you put them somewhere prominent, you tell guests you made it yourself. Price range: ₹3,000 to ₹70,000+. The Taj Mahal set (21056) deserves a specific mention for Indian buyers — it is one of the few LEGO sets with direct cultural relevance to us, and it looks extraordinary on a shelf.

Star Wars

The largest licensed theme in LEGO history, running since 1999. X-Wings, TIE Fighters, the Millennium Falcon, the Death Star. If you grew up with Star Wars, this theme requires no explanation. If you did not, the sets are still exceptional — the detail level on flagship sets is genuinely impressive. Entry sets start at ₹1,500. The UCS (Ultimate Collector Series) sets — large, complex, display-quality — run from ₹15,000 to ₹80,000+. High demand means these rarely go on sale. Buy when you see them in stock.

Harry Potter

Hogwarts Castle. Diagon Alley. The Hogwarts Express. For the generation that grew up with the books, this theme lands differently. Sets are consistently well-designed and the IP connection is strong. Price range similar to City — ₹1,500 to ₹20,000 for most sets. One of the better themes for gifting because the recognition factor is immediate.

Architecture

Minimalist, scaled-down versions of famous buildings. The Burj Khalifa. The Eiffel Tower in compact form. The Great Wall of China. These are adult sets — smaller piece counts, higher design sophistication, priced ₹3,000–8,000. They fit on a desk. They look like deliberate design objects, not toys. The best LEGO theme for people who think they do not like LEGO.

Ideas

Fan-designed sets that go through a public voting process before LEGO produces them. The results are consistently interesting — a working typewriter, a NASA Space Shuttle, a grand piano with moving keys. No predictable release schedule. When a good one drops, it sells out. Worth following closely.

Botanical Collection

Flowers, bonsai trees, succulents, a bird of paradise plant. Technically under Icons but worth separating out. These are the sets that converted an entirely new category of buyer — people who want something beautiful on a shelf and do not identify as LEGO fans. The Flower Bouquet (10280) is the single best gateway gift for someone who has never considered LEGO before. ₹3,500–9,000 range.

So which one is for you?

Child under 8: City or Duplo. No question.
Child 8–14 who likes action: Star Wars or Marvel.
Child 8–14 who likes building mechanics: Technic entry sets.
Adult who wants a display piece: Icons, Architecture, or Botanical.
Adult who likes engineering: Technic flagship sets.
Adult who wants something meditative and satisfying: any large Icons set.
Gift for someone who does not really like LEGO: Botanical Collection. Every time.

When in doubt, check bricksofindia.com — all themes, all stores, all prices in one place. Your wallet will appreciate the comparison before the commitment.`,
  },
  {
    slug: 'is-lego-worth-the-price-india',
    title: 'Is LEGO Worth the Price in India?',
    category: 'lego-101',
    published_at: ts(2),
    content: `Let's settle this properly. Because every Indian LEGO fan has had this conversation — with their spouse, their parents, their own brain at 2am while staring at a checkout page showing ₹12,000 for a box of plastic.

The short answer is: it depends on what you are comparing it to. The long answer is this entire guide.

Why LEGO costs what it costs

LEGO is not expensive because someone decided to be greedy. The premium has three real components.

First: manufacturing precision. Every LEGO brick is produced to a tolerance of 0.004mm — tighter than most industrial components. A brick made in 1958 fits a brick made today. That consistency requires expensive machinery and aggressive quality control. Cheaper construction toys exist because they cut exactly this corner. You will notice within ten minutes of building.

Second: design. LEGO employs hundreds of professional designers. The instruction booklets alone — clear, wordless, usable by a seven-year-old — represent serious investment. The building experience is a designed product, not just a pile of pieces.

Third: India import premium. This one is specific to us. LEGO does not manufacture in India. Every set is imported, which means exchange rate exposure, import duties, and retailer margin stack on top of the base price. A set that costs $60 in the US — already a premium price — lands in India at ₹7,500–9,000 depending on the store and timing. This is not a retailer scam. It is arithmetic.

What you are actually buying

A ₹5,000 LEGO set is not a ₹5,000 toy. It is closer to three things bundled together.

It is a 3–8 hour building experience — structured, satisfying, meditative for many adults. Comparable to a decent video game in terms of engagement hours per rupee, and considerably better for your posture.

It is a finished display object. A well-designed LEGO set on a shelf looks intentional. The Botanical sets in particular read as design objects, not children's toys. Guests ask about them.

It is a permanent asset. LEGO does not degrade. Sets from 20 years ago are still structurally intact. The secondary market for retired sets is real and active — some sets appreciate significantly. You are not burning money. You are, at worst, converting it into organised plastic.

Where it is genuinely not worth it

Honesty requires this section.

Licensed sets carry a premium for the IP that has nothing to do with the build quality. A Star Wars set at ₹8,000 and an equivalently complex City set at ₹5,500 may use the same number of pieces and offer the same building experience. You are paying ₹2,500 for the X-Wing shape. If the IP matters to you, fine. If you just want a good build, check piece count and build complexity first.

Sets below ₹1,500 are often poor value. The builds are simple, the piece counts are low, and the finished model is underwhelming. The sweet spot for most buyers is ₹2,500–8,000 — complex enough to be satisfying, priced reasonably relative to the experience.

And some sets are simply overpriced even by LEGO standards. The UCS Millennium Falcon at ₹75,000+ is extraordinary, but at that price you are deep into passion purchase territory. Nobody needs it. Some people want it badly enough to justify it. You know which category you are in.

The comparison that actually helps

Stop comparing LEGO to other toys. Compare it to other discretionary spending.

A ₹6,000 LEGO set versus a ₹6,000 dinner for two. The dinner is gone in two hours. The set takes a weekend to build and lives on your shelf for years.

A ₹4,500 LEGO set versus a ₹4,500 flight upgrade. One provides 4–6 hours of building satisfaction plus a permanent display piece. The other provides slightly more legroom for three hours.

Neither comparison makes LEGO cheap. But it reframes the question from why is this so expensive to what am I actually getting — which is the right question.

The verdict

For adults who build and display: worth it at ₹2,500–15,000 per set, especially if you use code ABHINAV12 at Toycra for 12% off above ₹500. Check prices across MyBrickHouse, Toycra, and Jaiman Toys before buying — the difference can be ₹1,000–3,000 on a mid-range set.

For children: worth it for ages 5–14 if the theme matches their interests. Expect the set to survive years of use, which most toys at the same price point will not.

For impulse purchases above ₹10,000: wait. Sleep on it. Check if it is retiring soon. A rested wallet makes better decisions than an excited one.

LEGO is worth the price in India. Just not at full price, and not without comparison shopping first.`,
  },
  {
    slug: 'how-to-store-display-lego-india',
    title: 'How to Store and Display LEGO in Indian Homes',
    category: 'lego-101',
    published_at: ts(3),
    content: `You built it. Took you a weekend, three cups of chai, and one mildly stressful instruction booklet. Now it is sitting on the floor next to the box because you have absolutely no idea where to put it.

This is the problem nobody talks about when they sell you a 1,500-piece set. LEGO takes up space. Indian homes — apartments especially — have complicated relationships with space. Here is how to make it work.

The enemy is dust

In India specifically, dust is not a minor inconvenience. It is a daily assault. An open LEGO display in a Mumbai or Delhi apartment will require cleaning every two to three weeks or it starts looking neglected. This is not optional maintenance — dusty LEGO looks bad and eventually the dust works its way into joints and connection points.

Your display strategy needs to account for this from the start. Either display behind glass, accept the cleaning schedule, or display only your most recent build and store the rest.

Display options that work in Indian homes

IKEA BILLY bookcase with glass doors is the single most popular LEGO display solution globally, and it works in India too. The glass doors handle the dust problem entirely. One full BILLY unit with three shelves holds eight to twelve medium sets comfortably. Cost in India: ₹8,000–12,000 depending on configuration. Available at IKEA stores in Mumbai, Hyderabad, Bengaluru, and Pune, or online.

IKEA DETOLF glass cabinet is the alternative for smaller collections or statement pieces. Designed as a display cabinet, fits in a corner, looks intentional. Holds four to six larger sets across its shelves. Around ₹8,500. The lighting upgrade — IKEA LEDBERG strip — adds another ₹1,500 and makes everything look significantly more impressive.

Custom shelving is worth considering if you are past twenty sets. A carpenter in any Indian city will build open shelving to your exact dimensions for ₹3,000–8,000 depending on size and city. Add a glass panel door later if dust becomes an issue. More flexible than flat-pack furniture and often better value at scale.

What not to do: open shelves in rooms with ceiling fans running constantly. The airflow accelerates dust accumulation dramatically. If open shelves are your only option, position them away from direct fan airflow and accept a weekly dusting routine.

Storage for sets you are not displaying

The original box is the correct storage solution and most people throw it away immediately. Do not throw it away. A set in its original box with the instruction booklet intact is worth significantly more on the secondary market than loose pieces in a bag. If you are short on space, break down the set, bag the pieces by colour or numbered bag, and store flat in the original box. It takes ten minutes and preserves the resale value entirely.

For bulk loose piece storage — if you have reached the stage of buying sets purely for parts — the IKEA TROFAST system is the Indian collector's standard. Stackable bins in multiple sizes, reasonably priced, and available at IKEA. Sort by colour or by piece type depending on how you build.

The humidity problem

This one is India-specific and almost never discussed. LEGO ABS plastic is not significantly affected by humidity itself — the bricks will not warp or degrade in normal conditions. However, instruction booklets and original boxes absolutely will. Mumbai and Chennai collectors especially: store boxes in a cool dry space, not in a loft or storage room that gets hot and humid in summer. A single monsoon season in a poorly ventilated storage space will destroy packaging that took years to accumulate.

If you are serious about preserving sets long-term, a small dehumidifier in your storage room is a worthwhile investment. ₹3,000–6,000 for a basic unit. Cheaper than replacing warped boxes.

For small apartments

The honest answer: you cannot display everything, so curate aggressively. Pick your five favourite sets for display. Rotate every three to four months. Store the rest broken down in original boxes stacked in a wardrobe. This is how most serious Indian LEGO collectors actually live — the Instagram shelf is real, the wardrobe full of flat boxes is also real.

Built sets that you genuinely love and will never part with deserve glass cabinet space. Everything else is in rotation.

The one rule

Never store LEGO in direct sunlight. Indian sun is not gentle. UV exposure yellows ABS plastic within months — white and light grey pieces especially. A beautiful white set left on a sunny windowsill will look like it was built in 1987 within a single summer. Glass cabinet, away from windows, or a wall away from direct light. Non-negotiable.

Your collection will thank you. Your wallet already spent enough getting it here.`,
  },
  {
    slug: 'lego-for-kids-vs-adults-india',
    title: 'LEGO for Kids vs Adults: Honest Answer',
    category: 'lego-101',
    published_at: ts(4),
    content: `The box says 18+. Your nine-year-old is already halfway through the instructions. Nobody is surprised.

LEGO has spent the last decade carefully building two separate product lines for two separate audiences while maintaining the convenient fiction that they are entirely different hobbies. They are not. The bricks are identical. The addiction is identical. The only real difference is how each group justifies the spending.

Here is the honest breakdown.

What LEGO designed for children actually looks like

Sets aimed at children — primarily City, Classic, Friends, and entry-level Technic — are designed around three principles: simple build steps, robust finished models, and immediate play value. The instruction booklets use larger diagrams. The piece counts are lower. The builds complete in one to two hours. The finished model does something — a car rolls, a door opens, a figure fits in a cockpit.

These sets are genuinely excellent for children between 5 and 14. The research on LEGO and child development is consistent: spatial reasoning, fine motor skills, patience, and the satisfaction of following a complex process to completion. This is not marketing copy. It is what actually happens when a child builds something and it works.

The price point reflects the audience. Most children's sets in India fall between ₹800 and ₹6,000. Reasonable for a toy that will survive years of use, which most alternatives at the same price will not.

What LEGO designed for adults actually looks like

The 18+ line — Icons, Architecture, Botanical, Creator Expert, UCS Star Wars — is designed around a completely different experience. Longer builds. Higher piece counts. More complex techniques. The finished model is a display object, not a play object. Instructions are detailed and assume patience. Some flagship sets take 10–20 hours to complete.

LEGO's own data is unambiguous: adult buyers now represent roughly half of global LEGO revenue. The Botanical Collection — flowers, bonsai, succulents — was explicitly designed for adults who had never considered LEGO before. It worked. The Flower Bouquet (10280) became one of LEGO's fastest-selling sets when it launched.

In India, adult LEGO collecting is a growing but still relatively small community. The price points are a significant barrier — a serious adult set typically starts at ₹8,000 and flagship pieces run to ₹70,000+. But the community exists, it is active on r/IndiaLEGO and AFOL India Facebook groups, and it is growing as disposable incomes rise and the cultural conversation around adult hobbies shifts.

The overlap nobody talks about

Here is the part the marketing materials skip.

Children regularly build sets rated 16+ with adult supervision and do fine. The age ratings are conservative and liability-driven, not developmental assessments. A curious 12-year-old with patience will handle most Technic sets without difficulty. A 10-year-old who loves Star Wars will work through a UCS set if given the time.

Adults regularly buy sets rated 6+ and enjoy them completely. A City Police Station at ₹3,500 is a satisfying two-hour build. There is no shame and no lesser experience. The piece count is lower; the enjoyment is not.

The practical guide: age ratings tell you about build complexity and small parts risk for very young children. They do not define what is appropriate for anyone above age 8. Buy what interests you or the person you are buying for, not what the box says is age-appropriate.

Buying LEGO as a gift — the decision tree

Child under 5: DUPLO only. Standard LEGO pieces are a choking hazard.

Child 5–8: City, Classic, or Friends depending on interests. Keep sets under ₹3,000. The build should complete in one sitting or they lose momentum.

Child 8–14: almost anything in the ₹2,000–8,000 range. Star Wars, Harry Potter, Technic entry sets, Ninjago. Ask what they are into. The IP connection matters at this age.

Teenager 14+: treat them like an adult buyer. Technic mid-range, Icons sets, or a theme they are genuinely passionate about. Do not default to a children's set because of habit.

Adult who has never bought LEGO: Botanical Collection as a starting point. Almost always lands well. If they have a specific passion — architecture, cars, space — there is a set for it.

Adult who already collects: check bricksofindia.com, find what they do not have in their preferred theme, buy that. Do not guess.

The real question

People ask whether LEGO is for kids or adults as if the answer changes the experience. It does not. The bricks do not know how old you are. The satisfaction of the last piece clicking into place is identical at age 8 and age 38.

The wallet pain, unfortunately, is also identical.

Use code ABHINAV12 at Toycra for 12% off on orders above ₹500. Check prices across MyBrickHouse, Toycra, and Jaiman Toys at bricksofindia.com before buying anything above ₹3,000. Age is just a number on the box. The build is the same.`,
  },
  {
    slug: 'lego-resale-market-india',
    title: 'The LEGO Resale Market in India: What You Need to Know',
    category: 'lego-101',
    published_at: ts(5),
    content: `Your LEGO collection is worth money. Possibly more than you paid for it. Almost certainly more than your spouse thinks it is worth. These are three different numbers and only one of them matters when you decide to sell.

The LEGO secondary market is a real, active, global ecosystem — and India's version of it is small, informal, and full of opportunity for buyers and sellers who know how it works. Here is everything you need to know.

Why LEGO holds and grows in value

LEGO sets are finite products. Every set has a production run, and when LEGO discontinues a set — retires it in collector terminology — no more are made. Ever. The moulds are not reused for the same set. The supply is permanently capped the day retirement happens.

Demand, meanwhile, does not cap. Star Wars fans keep being born. People who missed the UCS Millennium Falcon at retail keep wanting it. Collectors who built a set as a child want a sealed copy for display decades later.

The result is predictable: retired sets appreciate. Not all of them, and not always dramatically, but the pattern is consistent enough that serious collectors treat LEGO as a legitimate store of value. A sealed LEGO Star Wars UCS set bought at retail and held for five years will typically sell for 150–300% of its original price. Some sets do significantly better.

This is not speculation. It is documented resale history across platforms like eBay, BrickOwl, and historical BrickLink data going back twenty years.

The Indian resale market: how it actually works

India does not have a dedicated LEGO resale platform. The market runs across four channels:

OLX and Facebook Marketplace are where most casual Indian sellers list. Prices are inconsistent — some sellers dramatically overprice, some drastically underprice because they do not know the market. For buyers, this is opportunity. Search regularly, know your prices, move fast when something is undervalued.

r/IndiaLEGO on Reddit has an active buy/sell/trade thread. Smaller community than the global market but more trustworthy — Reddit accounts have history, the community self-polices, and prices tend to be more reasonable than OLX. Start here if you are new to Indian LEGO resale.

AFOL India Facebook groups operate similarly to the Reddit community. More active for certain categories, especially minifigures and bulk lot sales.

BrickOwl is now the global alternative for serious resale. BrickLink — the longtime standard for dedicated LEGO parts and sets trading — was acquired by LEGO and shut down operations in India in early 2025. Indian sellers and buyers have largely migrated to BrickOwl, which remains independent and functional in India. The caveat: BrickOwl tends to price at the higher end of the market. Useful for rare sets and parts where you need verified pricing history. For bulk lots or casual sales, the Indian community channels above will serve you better and cheaper.

What sells well in India

Star Wars sets consistently command the strongest premiums globally, and India is no exception. UCS sets especially — Millennium Falcon, AT-AT, Death Star — rarely depreciate and often appreciate significantly within two to three years of retirement.

Technic flagship sets hold value well. The Bugatti Chiron, Lamborghini Sián, McLaren — these are aspirational purchases in India where the actual cars are unattainable for most buyers. The LEGO version of a Ferrari is the closest many collectors will get.

Limited edition and Ideas sets appreciate reliably. The production runs are shorter and the designs are unusual enough to retain collector interest.

City and Friends sets do not appreciate. They are play sets, produced in large quantities, and the secondary market reflects that. Buy them for the build. Do not buy them as investments.

Sealed vs built: the price difference

A sealed, never-opened LEGO set is worth meaningfully more than the same set built and disassembled. The premium varies by set but is typically 30–60% for popular sets. The most valuable configuration is sealed box, all stickers unapplied, original receipt if available.

A built and displayed set with all pieces intact and original box is still worth a significant fraction of sealed price — typically 50–70% of sealed value for popular sets. Missing pieces, no box, or applied stickers all reduce value.

The practical implication: if you buy a set you think you might sell later, consider building it and keeping it intact in the box rather than displaying loose. The building experience is the same. The resale value is substantially better.

How to price your sets

Do not guess. Go to BrickOwl, search your set number, and look at completed sales in the last six months. That is the market price. Indian buyers will typically pay 80–90% of the BrickOwl price given the convenience of local transaction and no shipping cost. Price accordingly.

For sets with no BrickOwl history — very new sets, very obscure sets — use the original Indian retail price as a floor and adjust upward based on retirement status and demand signals.

The tax question nobody asks

Technically, regular income from selling goods — including LEGO — is taxable in India above certain thresholds. In practice, casual sellers transacting through OLX or Facebook for personal collection pieces are not being audited. If you are running a serious resale operation with consistent volume and profit, that is a different conversation and you should speak to a CA.

For the vast majority of Indian collectors selling an occasional set: price fairly, transact safely, and keep records.

The one thing that matters most

Buy sets you genuinely want to own, at prices that make sense to you, from verified Indian retailers. Use code ABHINAV12 at Toycra for 12% off above ₹500. Check prices at bricksofindia.com before any purchase above ₹3,000.

If a set appreciates and you sell it later for a profit, that is a bonus. If it does not, you still built something excellent and it is sitting on your shelf looking good.

Your wallet went in knowing the risk. It usually comes out ahead.`,
  },
  {
    slug: 'lego-vs-chinese-clones-india',
    title: 'LEGO vs Chinese Clones: Honest Comparison',
    category: 'lego-101',
    published_at: ts(6),
    content: `Your wallet has done the math. A Lepin version of the Millennium Falcon for ₹4,000 versus the LEGO original for ₹75,000. The spreadsheet is not subtle. But the spreadsheet is also missing several important columns.

This is the guide nobody in the official LEGO community wants to write honestly. We are going to write it honestly.

What Chinese clone brands actually are

Clone brands — Lepin, Cada, Mould King, CaDA, Sembo, and dozens of others — are Chinese manufacturers producing LEGO-compatible construction sets. Some are straightforward copies of existing LEGO sets. Others are original designs that happen to use the same brick system. The quality varies enormously between brands and even between sets from the same brand.

The market has matured significantly in the last five years. Early clone sets were obviously inferior — soft plastic, poor tolerances, pieces that did not connect cleanly. The better brands today — Mould King and CaDA specifically — produce sets that serious builders describe as genuinely good. Not LEGO good. But good.

Where clone brands are straightforwardly worse

Plastic quality is the fundamental difference. LEGO's ABS plastic is manufactured to tolerances that clone brands do not match. The tactile difference is real — LEGO bricks have a specific resistance and click that clone bricks approximate but do not replicate. Over a long build this difference compounds. LEGO feels precise. Good clones feel close. Budget clones feel like toy bricks.

Clutch power — the force required to connect and separate bricks — is inconsistent in clone sets in a way it simply is not in LEGO. Pieces that connect too loosely fall apart during building. Pieces that connect too tightly are frustrating and occasionally damage the plastic. LEGO has spent decades calibrating this. Clone brands have not.

Instructions vary wildly. LEGO's wordless, numbered-step booklets are a genuinely world-class design product. Clone instructions range from acceptable to incomprehensible. Some sets ship with instructions clearly photographed from the original LEGO booklet with LEGO branding clumsily removed. This is not a compliment.

Colour consistency within a set can be a problem. LEGO's colour matching across pieces is precise — a light bluish grey piece from one bag matches a light bluish grey piece from another bag exactly. Clone sets sometimes have visible variation. For display models this is a cosmetic issue. It is still an issue.

Where the gap is smaller than you think

For large display models that you build once and never touch again — a skyline set, an architectural landmark, a large vehicle — the practical difference between a good clone and LEGO narrows considerably. The finished model looks similar. The building experience was acceptable. The piece sits on the shelf.

Mould King's architectural and mechanical sets in particular have genuine engineering in them. Their large cranes, excavators, and technical vehicles have earned real respect from the builder community — not as LEGO alternatives but as interesting builds in their own right.

For children who are rough on toys, the quality gap matters less in a different direction — if a set is going to be pulled apart and rebuilt daily, paying five times more for LEGO's precision engineering is harder to justify purely on durability grounds. LEGO is more durable. But not five times more durable.

The legal and ethical dimension

This section exists because honesty requires it.

Sets that directly copy LEGO's original designs — not the brick system, which LEGO's patent on expired decades ago, but the specific set designs — are infringing LEGO's intellectual property. Lepin was successfully sued by LEGO and shut down. The companies that replaced it operate in a legal grey area that varies by jurisdiction.

Buying a clone of a LEGO-original design supports IP infringement. That is a straightforward fact. What you do with that fact is your decision. We are not going to tell you that you are a bad person for buying a ₹2,000 set instead of a ₹18,000 one when your budget is what it is. Indian wallet realities are real. But the situation should be named clearly.

Clone brands with original designs — Mould King's technic vehicles, CaDA's architectural series — occupy cleaner ethical ground. They use a compatible brick system, which is legal, and design their own models, which is also legal. These are the brands worth considering if you are exploring outside LEGO.

The India-specific calculation

In most Western markets the clone brand conversation is about saving 60–70% on a set. In India the calculation is different because the LEGO premium is already extreme.

A LEGO set priced at $60 in the US costs ₹7,500–9,000 in India. The equivalent clone set costs ₹1,500–2,500 from Indian sellers on Amazon or directly from Chinese platforms. That is not a 60% saving. That is an 80% saving on an already-inflated base price.

For Indian buyers on tight budgets who genuinely want the building experience, the honest answer is: good clone brands are a reasonable entry point. Mould King and CaDA over any brand you have not heard of. Original designs over LEGO copies. And if you ever have the budget for the real thing, the difference will be immediately apparent and you will understand what you were missing.

The verdict

Buy LEGO when you can. The quality difference is real, the brand has earned its premium, and supporting the official ecosystem keeps the hobby healthy.

When the budget does not stretch: Mould King or CaDA original designs are acceptable alternatives. Avoid direct LEGO copies on principle and on quality grounds — the instructions are worse and the sets are legally compromised.

Never buy the cheapest clone you can find. The bottom of the clone market is genuinely bad. The ₹500 knockoff Technic set from an unknown brand will frustrate you into hating construction toys entirely. Spend the extra ₹800 for a brand with a track record.

For verified LEGO at the best Indian prices, check bricksofindia.com — MyBrickHouse, Toycra, and Jaiman Toys all on one page. Use code ABHINAV12 at Toycra for 12% off above ₹500. Your wallet has enough problems without also paying full price.`,
  },
];

// ── Insert ────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`Inserting ${guides.length} guides...\n`);

  for (const g of guides) {
    const wc  = wordCount(g.content);
    const rt  = Math.ceil(wc / 200);
    const ex  = excerpt(g.content);

    const { data, error } = await sb
      .from('guides')
      .insert({
        slug:              g.slug,
        title:             g.title,
        content:           g.content,
        excerpt:           ex,
        category:          g.category,
        read_time_minutes: rt,
        published_at:      g.published_at,
      })
      .select('id, slug, published_at')
      .single();

    if (error) {
      console.error(`FAIL  ${g.slug}: ${error.message}`);
    } else {
      console.log(`OK    id=${data.id}  ${data.slug}  (${wc}w, ${rt}min)  ${data.published_at}`);
    }
  }

  // ── Final count ──────────────────────────────────────────────────────────────
  console.log('\n── Final state ─────────────────────────────');
  const { data: rows, error: countErr } = await sb
    .from('guides')
    .select('id, slug, published_at')
    .order('published_at', { ascending: true });

  if (countErr) { console.error('Count query failed:', countErr.message); return; }
  console.log(`Total rows: ${rows.length}`);
  for (const r of rows) console.log(`  ${r.id}  ${r.slug}  ${r.published_at}`);
})();
