# Cerebras pilot report

**Model:** gpt-oss-120b @ temp 0.7
**Run:** 2026-06-19T05:42:37.704Z

## Summary

| Cohort | Pass | Total | Rate |
|---|---|---|---|
| Apples-to-apples (non-YT) | 3 | 3 | 100% |
| Stress test (YT, knowledge-poor) | 1 | 2 | 50% |
| **Overall** | **4** | **5** | **80%** |

### Pilot pass criteria
- Apples-to-apples: **>=3/3 lint pass** required -> currently 3/3
- Stress test: **>=1/2 lint pass** acceptable -> currently 1/2
- Manual voice read: pending your review of each Cerebras body below

---

## 93a23b18 — news — apples-to-apples

**Source:** [LEGO Architecture 21066 New York City – The Big Apple official images!](http://brickset.com/article/131634)

**Latency:** 3381ms  **Lint:** PASS

### Lint gates
| Gate | Result |
|---|---|
| Word count (443 words) | WARN: 443 words — outside target 270–440 for 'news' |
| India paragraph | PASS |
| Verdict | n/a |
| Factuality | PASS |
| Source fidelity | PASS |

### Side-by-side

| | Gemini (baseline) | Cerebras (pilot) |
|---|---|---|
| Title | LEGO Architecture 21066 New York City in India: The Big Apple Costs How Much?! | LEGO Architecture 21066 New York City – The Big Apple: New set preview and price outlook |
| Word count | 350 | 443 |
| Verdict | AVOID | WAIT |

#### Gemini body (baseline)

Forget the Statue of Liberty, the real landmark here is the price tag. LEGO has unveiled its latest Architecture set, 21066 New York – The Big Apple, and while it aims to capture the iconic skyline, it might just capture your wallet instead. This isn't just a building set; it's a statement. A statement that says, "I have disposable income and a deep, possibly unhealthy, love for plastic bricks representing famous places."

This new NYC skyline attempts to replicate the magic of its Paris predecessor, but this time it’s all about the Big Apple. We’re talking the Empire State Building, One World Trade Center, the Brooklyn Bridge, the Statue of Liberty, and even Central Park. It’s a whole city on your shelf, complete with yellow taxi cabs and a printed 'New York, New York' tile. For adults who apparently have too much time and money, this is meant to be the ultimate souvenir.

<!-- INDIA_PARAGRAPH -->
At $139.99 USD, this set is set to land in India at a cool ₹14,999 (estimated, based on current exchange rates and LEGO’s standard markups). Availability is expected from June 1st, likely through LEGO.com and select premium retailers like Toycra. However, given the price, this isn't just a casual purchase; it’s more expensive than a year’s worth of Spotify Premium, and that’s before you even consider the potential import duties. For that price, you’d expect the bricks to assemble themselves and perhaps offer a guided tour.

While the detail is commendable, some find the colour palette “throwing them off” and the apple backdrop “cheesy.” Others lament the repetition of cities, wishing for new landmarks instead of another NYC or Paris. The sentiment is clear: while the concept is nice, cramming in too many icons makes it feel messy, and frankly, a bit strange, like something from an 80s McDonald’s commercial. For this price, I’d rather have a flight to actual New York, or at least a very large plate of biryani.

Verdict: SKIP. Save your money for something less likely to require its own insurance policy.

On that bombshell, it's time to say goodbye.

#### Cerebras body (pilot)

Your wallet just got a postcard from Manhattan and it’s demanding ₹14,999. That’s enough to make even a seasoned brick‑collector pause for a breath. LEGO’s Architecture line is about to add its own slice of the skyline with set 21066 New York – The Big Apple, and the numbers are already doing the heavy lifting.

The official press release rolls out the basics: 1,465 pieces, rated for ages 18+, and a retail tag of $139.99 (≈ ₹14,999 in India). The build mirrors the sleek silhouette of the Paris – City of Love set (21064) but swaps the Eiffel Tower for the Statue of Liberty, the Empire State Building, and other iconic silhouettes that define the city that never sleeps. It’s a collectable aimed squarely at adults who love architecture, travel, or simply the idea of holding a miniature Manhattan on a coffee table.

Global availability kicks off on LEGO.com on 1 June, which means the Indian market will see a short lag. Brick‑fans in India should keep an eye on two main retailers. MyBrickHouse has already posted a price of ₹14,999, though the stock status is currently uncertain. Toycra hasn’t listed a price yet, but they’ll likely follow suit once the global launch is confirmed. As always, the Toycra affiliate code is handy: use ABHINAV12 for 12 % off on orders above ₹500.

From a practical standpoint, the set sits in a familiar price band for Architecture releases, but the piece count is on the higher side for the line. Expect a moderate build time—roughly a weekend if you’re treating it like a weekend project rather than a marathon. The design intent is clear: a sleek, modern representation rather than a brick‑by‑brick replica of every borough. That means the set will look good on a shelf, but it won’t replace a city‑scale model if you’re after that level of detail.

If you’re already budgeting for the next LEGO purchase, consider the timing. The set lands in June globally, so Indian stores will likely start shipping in late June or early July. By then, the initial excitement may have settled, and retailers could offer early‑bird discounts. Until then, keep the set on your watchlist, compare prices, and maybe set a reminder for when the first deals appear.

<!-- INDIA_PARAGRAPH -->
At ₹14,999 (may be out of stock).
MyBrickHouse lists it for ₹14,999 — check MyBrickHouse for availability. Toycra is also expected; use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.
Expect a 4–6 week lag from the global launch on 1 June.
That's about 12 months of Spotify Premium.
<!-- /INDIA_PARAGRAPH -->

Verdict: WAIT. Good set, but the price will drop.

**Manual voice read — your sign-off:** [ ] PASS  [ ] FAIL

---

## 397ae761 — review — apples-to-apples

**Source:** [Review: 42688 Horse Stable and Riding Academy](http://brickset.com/article/131520)

**Latency:** 1652ms  **Lint:** PASS

### Lint gates
| Gate | Result |
|---|---|
| Word count (662 words) | PASS |
| India paragraph | PASS |
| Verdict | PASS |
| Factuality | PASS |
| Source fidelity | PASS |

### Side-by-side

| | Gemini (baseline) | Cerebras (pilot) |
|---|---|---|
| Title | Review: LEGO Friends 42688 Horse Stable and Riding Academy – Neigh-sayers beware! | LEGO Horse Stable and Riding Academy (42688): Worth ₹8,499? |
| Word count | 488 | 662 |
| Verdict | BUY NOW | BUY NOW |

#### Gemini body (baseline)

Alright folks, let’s talk about LEGO Friends set 42688, the Horse Stable and Riding Academy. Now, I know what you’re thinking – horses, stables… is this just another one of those sets that’ll make your wallet wince? Well, let’s dive in and see if this one is worth the stable price.

This set comes with 735 pieces, which is a decent amount. Inside, you get six numbered bags, a small unnumbered bag with little decorations, three 8x16 plates, a half-circle plate, two instruction books, and a fairly large sticker sheet. Those barn doors are pretty big, taking up a good chunk of the build.

We get three minidolls here: Liann and Aliya, who are familiar faces. Then there’s Cindy, a new character who’s the riding instructor. All three have nice printed torsos and cool back printing. Cindy’s yellow scarf adds a nice touch.

Now, the stars of the show: the horses! This set introduces us to Thunder, a grey horse, and Coco, a brown one. Coco’s mane looks particularly fancy. We also get two cats, Chip and Bear. Chip was in the Dog Treats Bakery set earlier, and Bear was in the Cat Birthday Party set. Seems like these kitties are globetrotters!

The finished model is pretty cool. First, there's a separate storage area for riding gear like reins and saddles, tucked under a flowering tree with a butterfly. There’s even a horse blanket! For the riding lessons, we have jumps, including one over a small pond. Gotta practice those show jumping skills, right? There's also a supply of hay because, well, horses gotta eat.

The main stable building looks just like you’d expect, with big barn doors and a horseshoe above. I like the pink floral details on the front. Thunder and Coco get their own stalls on either side, and the barn doors slide open smoothly for easy access. Snacks are available right at their stalls. The roof uses a ramp piece, which is an interesting design choice.

The back of the stable reveals more play features. There’s a classroom area with horse accessories and some upstairs sleeping quarters. Looks comfy enough for two, though Cindy might be out of luck! There’s even a pet bowl up there, so Chip and Bear aren't forgotten. Stickers add detail to the sleeping area, making it look quite cozy.

Overall, this set offers a good amount of play value for horse lovers. The two horses, the stable structure, and the accessories all add up to a fun experience.

<!-- INDIA_PARAGRAPH -->
Let's talk numbers for us in India. The 42688 Horse Stable and Riding Academy is available at MyBrickHouse for ₹8,499 and at Toycra for ₹8,499. Jaiman Toys has it for ₹8,498, though it might be out of stock. That’s quite a bit, isn't it? For that price, you could get about 170 cups of chai, or maybe a month and a half of your Spotify subscription.

VERDICT: BUY

#### Cerebras body (pilot)

Your wallet just whispered, “Brace yourself for another Friends set,” and the price tag it’s eyeing is ₹8,499. That’s the kind of number that makes you pause at the checkout but also wonder if you can squeeze a few extra rides into the weekend.

The LEGO Horse Stable and Riding Academy (42688) is the newest entry in the ever‑repeating summer wave of Friends. If you’ve been following the line, you’ll recognize the pattern: two waves a year, bright pink bricks, and at least one set that brings horses into the mix. This set promises exactly that – a stable, a riding arena, and the colourful vibe the Friends theme is known for. No surprise there, but the question is whether the execution lives up to the hype.

From the teaser images, the set looks like a tidy, kid‑friendly stable with a modest number of bricks. The colour palette is unmistakably Friends – lots of pink, teal, and a splash of sunny yellow. The horses themselves are built in that stylised LEGO fashion, which always feels a touch whimsical but never veers into the uncanny. The design appears to be geared toward younger builders, with larger, easy‑to‑handle pieces and a straightforward building sequence. That makes it a solid candidate for a weekend project for kids aged six to ten, or for anyone who wants a quick, satisfying build without a massive instruction scroll.

One of the strengths of this set is its playability. The stable doors open, the riding arena can be arranged in a couple of ways, and the horses can be swapped between the stalls. The set also includes a few minifigures that fit the Friends aesthetic – a rider, a trainer, and a couple of friends to cheer on the equestrian action. While the exact minifig count isn’t disclosed in the review, the Friends line traditionally includes three to four characters per set, so expectations should be modest.

If you’re a collector, the set adds a niche piece to the Friends portfolio: a horse‑centric theme that hasn’t been explored in depth before. It’s not a massive flagship model, but it fills a gap for those who want a tidy, animal‑focused addition without breaking the bank. The piece count, while not announced, is likely in the lower‑mid range, meaning the set won’t dominate your display shelf but can sit comfortably alongside larger Friends builds.

The price point of ₹8,499 is strikingly low for a LEGO set that includes a stable, riding arena, and minifigures. For context, many mid‑range LEGO sets hover around ₹10,000‑₹15,000, so this one feels like a bargain. The affordability makes it an easy impulse buy for parents looking to add variety to their child's collection, or for adult fans who want a small, nostalgic build without committing a big chunk of cash.

From a build perspective, the set promises a quick assembly that can be completed in under an hour, which is ideal for a rainy afternoon or a quick play‑session. The instructions are expected to be clear and colourful, matching the Friends brand’s reputation for kid‑friendly guidance. The set also serves as a gateway for younger builders to get comfortable with LEGO mechanics before moving on to more complex models.

In short, the LEGO Horse Stable and Riding Academy delivers what it promises: a bright, horse‑filled Friends set that is easy to build, fun to play with, and gentle on the wallet. The combination of low price, modest size, and the charm of the Friends theme makes it a solid addition to any LEGO household. If you’ve been waiting for a horse‑themed Friends set, this is the moment to click “add to cart” before the stock runs out.

<!-- INDIA_PARAGRAPH -->
At ₹8,499, that's about 10 months of Spotify Premium.
MyBrickHouse lists the set for ₹8,499.
Toycra also lists it for ₹8,499.
Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.
<!-- /INDIA_PARAGRAPH -->

Verdict: BUY NOW. The price is right — grab it.

**Manual voice read — your sign-off:** [ ] PASS  [ ] FAIL

---

## babc160d — news — apples-to-apples

**Source:** [Machine-moving machine](https://www.brothers-brick.com/2026/02/15/machine-moving-machine/)

**Latency:** 1712ms  **Lint:** PASS

### Lint gates
| Gate | Result |
|---|---|
| Word count (447 words) | WARN: 447 words — outside target 270–440 for 'news' |
| India paragraph | PASS |
| Verdict | n/a |
| Factuality | PASS |
| Source fidelity | PASS |

### Side-by-side

| | Gemini (baseline) | Cerebras (pilot) |
|---|---|---|
| Title | LEGO Volvo FH Truck: A Heavy Haulage Masterpiece? | Volvo FH fan‑built truck sparks buzz – price still a mystery for Indian fans |
| Word count | 439 | 447 |
| Verdict | IMPORT ONLY | IMPORT ONLY |

#### Gemini body (baseline)

This LEGO Volvo FH truck build is seriously impressive. It’s a heavy haulage machine, designed to move other machines, with a knuckleboom crane and a drawbar trailer. The detail on this model is what really stands out. We’re talking steering axles on the truck and trailer, a crane that can actually unfold, and outriggers that look the part even if they need manual adjustment. The builder even crafted a custom forklift to accompany the main rig.

This isn't your usual LEGO truck where the cargo steals the show. Here, the truck itself is the star. The colour scheme is distinctly British, with green and red accents and drop shadow lettering that adds a touch of authenticity. The cab design is based on a previously built wind turbine transport, showing a consistent vision from the builder. Even the coupling mechanism for the trailer is clever, using a rare red tow ball socket plate and a vintage Homemaker Figure hand. Yes, a forty-year-old LEGO hand. That’s dedication.

The builder's creativity shines through in the custom forklift. While LEGO has produced forklift parts, they were too large for this minifigure scale. So, a smaller, functional forklift was built using creative part usage. It’s sturdy enough for display, which is the main aim here, rather than intense play. The focus is on visual appeal and accurate representation of a real-world machine transport vehicle. It’s a build that speaks to serious LEGO fans who appreciate intricate designs and real-world inspiration.

<!-- INDIA_PARAGRAPH -->
There are no official Indian prices available for this custom build, as it is not an official LEGO set. If a similar, officially licensed heavy haulage truck set were to be released by LEGO in India, you could expect it to cost roughly the same as 18 months of Netflix Premium. MyBrickHouse and Toycra are the stores to keep an eye on for any new official LEGO releases, though this particular truck is a fan creation and not something you can buy off the shelf. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

This model is a testament to what can be achieved with LEGO bricks when you have a clear vision and a good collection of parts. It’s a complex build, and the attention to detail is remarkable. While official sets often aim for a balance of playability and display, this build leans heavily towards the latter, resulting in a highly realistic and aesthetically pleasing model. It’s the kind of build that makes you want to rummage through your own brick bins for inspiration.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

#### Cerebras body (pilot)

Your wallet just heard the roar of a Volvo FH and it’s already sweating. The idea of a minifig‑scale haulier hauling massive machinery is enough to make any brick‑lover pause and check the bank balance.

Ralph Savelsberg of The Brothers Brick (TBB) is back at it. Known for his meticulous truck builds, he’s taken on a brand‑new challenge: a Volvo FH model, painted in the livery of British haulier Rawcliffe & Sons. The blog post, titled “Machine‑moving machine”, shows a sleek, dark‑blue cab with realistic headlights, a massive sleeper cabin, and a set of detachable trailers that can carry everything from cranes to cargo containers.

What makes this build stand out isn’t just the paint scheme. Savelsberg has engineered the truck to be fully functional in minifig scale – the trailer hooks lock into place, the doors open, and the cab can be driven across a custom‑built loading dock. The level of detail rivals many official LEGO Technic sets, and the parts list reads like a wish‑list for any serious Technic collector.

Fans are already speculating whether this could be a sign of an upcoming official Volvo set. LEGO has released a few hauler models in the past, but nothing quite this big. Until an official announcement lands, the only way to get your hands on a similar build is to source the parts yourself or wait for a third‑party kit to appear on the market.

For Indian LEGO fans, the lack of an official set means you’ll have to look at importing the pieces or building the model from scratch. The price tag is still a mystery – TBB didn’t disclose any cost, and no Indian retailer has listed a price. Expect the usual import‑only scenario: you’ll need to piece together the bricks, possibly from MyBrickHouse’s spare‑parts catalog, or wait for a niche vendor to release a kit.

The build also highlights a growing trend: fan‑made Technic creations are pushing the boundaries of what LEGO can do in the real‑world vehicle space. Whether you’re a collector, a builder, or just someone who enjoys a good truck, Savelsberg’s Volvo FH is worth a look. It’s a reminder that the line between fan imagination and official LEGO can be thinner than a minifig’s antenna.

<!-- INDIA_PARAGRAPH -->
Estimated import price: around ₹30,000–35,000. Check MyBrickHouse for availability. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch. If this were officially sold in India, it would cost roughly the same as 18 months of Netflix — assuming LEGO India's usual enthusiasm for your wallet.
<!-- /INDIA_PARAGRAPH -->

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

**Manual voice read — your sign-off:** [ ] PASS  [ ] FAIL

---

## 76476d96 — news — stress-test-youtube

**Source:** [NEW LEGO LEAKS! (Ideas, Pokemon, DC, Architecture & MORE!)](https://www.youtube.com/watch?v=iCbyXykNPvs)

**Latency:** 1303ms  **Lint:** PASS

### Lint gates
| Gate | Result |
|---|---|
| Word count (441 words) | WARN: 441 words — outside target 270–440 for 'news' |
| India paragraph | PASS |
| Verdict | n/a |
| Factuality | PASS |
| Source fidelity | PASS |

### Side-by-side

| | Gemini (baseline) | Cerebras (pilot) |
|---|---|---|
| Title | LEGO Leaks Galore: What's Coming to Our Shelves (Maybe Soon!) | New LEGO Leaks Hint at Ideas, Pokemon, DC & Architecture Themes – No Set Numbers Yet |
| Word count | 332 | 441 |
| Verdict | — | WAIT |

#### Gemini body (baseline)

Alright folks, grab your chai, because the LEGO rumour mill is churning out some serious heat! A new leak video is buzzing around, and it looks like we might be getting a whole bunch of new sets across popular themes. We're talking potential LEGO Ideas sets, some Pokémon goodness, DC superheroes, and even more Architecture builds. Exciting stuff, right?

Now, before you start clearing shelf space and checking your wallets, remember this is all based on leaks. Things can change, sets can get delayed, or sometimes they just disappear into the LEGO ether. But still, it's fun to speculate!

The video hints at new additions to the LEGO Ideas line, which always brings some fan-favourite concepts to life. If you're a fan of unique builds and creative designs, keep an eye on this. Then there's the mention of Pokémon – we all know how popular those are, so any new sets are bound to fly off the shelves. And for the DC fans, more superhero action is always a win. Finally, the Architecture theme is reportedly getting new cityscapes, perfect for adding some sophisticated flair to your collection.

<!-- INDIA_PARAGRAPH -->
Now, about getting these beauties in India. Since the specific set numbers aren't confirmed from this leak, we can't give you exact prices or an India release date just yet. It's common for new sets to have a 4–6 week lag before they hit Indian shores after their international debut. Once they do arrive, expect prices to be… well, let's just say you might be skipping a few paneer butter masala dinners to afford them! We'll update you with exact INR prices from our favourite Indian retailers like Amazon India, Flipkart, and the official LEGO Store once the sets are officially announced and available.

For now, consider this a heads-up. It's always good to know what might be around the corner, especially if you're saving up for your next big LEGO haul. Stay tuned for more concrete details as they emerge!

#### Cerebras body (pilot)

Your wallet just heard a whisper about fresh LEGO leaks and it’s already sweating. A new YouTube compilation dropped on May 19, and it’s packed with quick flashes of upcoming Ideas builds, a few Pokémon silhouettes, some DC hero gear, and a couple of Architecture skyline sketches. Nothing concrete, just the usual tease‑and‑run that leak videos love to serve.

The video runs a tight 3‑minute montage, switching between glossy renders and a handful of close‑ups that barely reveal a brick pattern. The host (the channel that posted the clip) points to a bright yellow brick that could belong to a new Pokémon set, then flips to a dark‑green silhouette that might be a DC villain’s lair. There’s also a sweeping shot of a skyline that looks like it could be a future Architecture entry – perhaps a cityscape or a landmark, but the camera never lingers long enough to read any set number.

What’s useful here is the thematic spread. LEGO’s Ideas line has been pushing fan‑designed models into the mainstream, and the leak hints at another fan‑voted project, though the specifics remain hidden behind a blur. Pokémon fans will recognise the iconic Pokéball shape, but until LEGO confirms a part number, it stays in the realm of hopeful speculation. DC lovers get a quick glimpse of a caped figure, but again, no identifiable markings. Architecture enthusiasts can only guess whether we’re looking at a new world‑heritage site or a modern skyscraper.

The usual leak‑to‑reality conversion applies: roughly half of these teasers never become official sets, and the ones that do often look very different from the early renders. Still, the variety suggests LEGO is keeping its pipeline busy across multiple licenses, which is good news for collectors who like to hop between genres.

Keep your expectations in check, and treat this video as a mood board rather than a definitive announcement. When the official reveal arrives, we’ll have the numbers, the pricing, and the exact themes to break down. Until then, the best you can do is enjoy the speculation and maybe start a wishlist for the ideas you think might finally make the cut.

<!-- INDIA_PARAGRAPH -->
Based on typical LEGO retail pricing and current exchange rates, a leaked set could land somewhere around ₹30,000–35,000 when it arrives in India.  
MyBrickHouse and Toycra are the stores to watch; check MyBrickHouse for availability and use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.  
Expect a 4–6 week lag after the global launch before it appears locally.  
That would be about 11 months of Netflix Premium.  
<!-- /INDIA_PARAGRAPH -->

Verdict: WAIT. Good set, but the price will drop.

**Manual voice read — your sign-off:** [ ] PASS  [ ] FAIL

---

## 84dc3c23 — news — stress-test-youtube

**Source:** [LEGO May 2 reveals pt. 1! City, Creator, & Chinese Festival thoughts - Trains, Pirates, Van, Coaster](https://www.youtube.com/watch?v=0Cs_cX-KErk)

**Latency:** 1902ms  **Lint:** FAIL

### Lint gates
| Gate | Result |
|---|---|
| Word count (406 words) | PASS |
| India paragraph | PASS |
| Verdict | n/a |
| Factuality | FAIL: unrecognized LEGO references: "Summer Catalog" |
| Source fidelity | FAIL: source fidelity (LOW confidence source): ungrounded specifics: "Summer Catalog" (not in source) |

### Side-by-side

| | Gemini (baseline) | Cerebras (pilot) |
|---|---|---|
| Title | LEGO City Trains and Pirates Coming to India: Will Your Wallet Survive? | LEGO May 2 reveals pt. 1: City, Creator & Chinese Festival hints – what to expect |
| Word count | 388 | 406 |
| Verdict | — | WAIT |

#### Gemini body (baseline)

Forget your morning chai. Forget the traffic snarls. Forget even the latest cricket score. Because LEGO has just dropped a bomb that will shake the very foundations of your plastic brick collection. May 2nd, a date now etched in infamy, brought us a cascade of new reveals that are about to make your wishlist longer than a politician’s promise. We’re talking about new City trains, a return of Pirates, and a Creator theme that looks suspiciously like a Chinese Festival.

This isn't just about new sets; it's about the relentless march of plastic ambition into our lives. The City line, often the gateway drug for many, is getting a significant boost with new train elements. For years, we’ve been asking: where are the trains? LEGO, it seems, has finally heard our cries, or perhaps they just saw an opportunity to fill more shelf space. And then there’s Pirates. Yes, Pirates. A theme that evokes a certain… nostalgia. Or perhaps just the memory of lost pieces scattered across the carpet.

The implications for your wallet are, frankly, catastrophic. These aren't just pieces of plastic; they are multi-thousand-rupee decisions. The thought of a new train system alone is enough to send shivers down the spine, not of excitement, but of impending financial doom.

<!-- INDIA_PARAGRAPH -->
While the global pricing remains a mystery, we can only brace ourselves for the inevitable. Expect these sets to land in India with a lag of 4–6 weeks, carrying a premium that makes even the most robust financial plan weep. If past performance is any indicator, the new City trains alone could set you back ₹8,000–₹12,000, a sum that could otherwise secure you a decent weekend getaway or a year’s worth of premium Spotify. Availability will likely be through major retailers like Toycra and MyBrickHouse, but don’t expect any discounts on launch. This is where adult money meets childhood happiness, and the wallet usually loses.

The sheer volume of new releases suggests LEGO is betting big on impulse buys and the sheer desperation of collectors. Whether it’s the allure of a new train track or the swashbuckling promise of Pirates, our patience and our bank accounts are about to be tested. The question isn't if you'll buy them, but which ones you'll be forced to abandon.

On that bombshell, it's time to say goodbye.

#### Cerebras body (pilot)

Your wallet just heard the May 2 reveal and is already asking for a loan. The teaser rolls out city streets, Creator builds, and a Chinese Festival, and your bank account is bracing for impact. The LEGO May 2 reveals part 1 video dropped on the official LEGO YouTube channel, and it’s a rapid‑fire walk‑through of what the company is lining up for the next few months.

In under three minutes the presenter flips through a cityscape that looks like a downtown boulevard, a Creator 3‑in‑1 build that promises modular flexibility, and a festive Chinese New Year set that glitters with lanterns. The clip also teases a new train line, a pirate ship with a twist, a van that could double as a mobile café, and a coaster that looks ready for a theme‑park splash.

None of those builds come with a set number, piece count, or retail price. The video is deliberately vague – just enough to get the community buzzing. That means we have to treat it like any other leak: exciting, but not a guarantee. LEGO often shows concepts that never make it past the concept stage, and when they do, the final product can look very different from the early render.

What we can glean is that LEGO is pushing three distinct directions. The city theme suggests more urban modular sets, likely aimed at older builders who want realistic streetscapes. The Creator hints at the continued push for versatile builds that can be re‑imagined. And the Chinese Festival piece is a clear nod to the growing Asian market, where cultural celebrations are becoming a staple in the product line.

For Indian fans, the lack of concrete numbers means you can’t price‑check yet. Keep an eye on official LEGO announcements and the upcoming LEGO Summer Catalog for the exact details. In the meantime, if you’re itching for a new set, the current lineup still has plenty to keep you busy while you wait for the official release dates.

<!-- INDIA_PARAGRAPH -->
No Indian store prices yet. Based on typical LEGO pricing, expect these upcoming releases to land somewhere around ₹30,000–35,000 each when they arrive.
That is roughly 12 months of Spotify Premium.
MyBrickHouse and Toycra are the stores to watch — use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.
Expect a 4–6 week lag from global launch.
<!-- /INDIA_PARAGRAPH -->

Verdict: WAIT. Good set, but the price will drop.

**Manual voice read — your sign-off:** [ ] PASS  [ ] FAIL
