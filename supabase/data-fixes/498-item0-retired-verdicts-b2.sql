-- boi:issue 498
-- boi:backup-tables public.reviews, public.news_articles
-- boi:expect-before select (select count(*) from public.reviews where (slug, md5(content), verdict) in (values ('lego-rontu-the-master-dragon-71842-worth-4999','0f6dcbff8a8e7a6d10785c928382dbb2','RETIRED'), ('lego-hagrid-harrys-motorcycle-ride-76443-worth-5449','c9f9fadc13eace141e758ad89a6ca43b','RETIRED'), ('lego-daily-bugle-76178-worth-39999','4818f8083c018369c9801eb8b536e106','RETIRED'))) + (select count(*) from public.news_articles where (slug, md5(content), verdict) in (values ('lego-captain-america-vs-red-hulk-battle-76292-worth-5949','4627700a02a9279a5159c863c05a0fa8','RETIRED'))) = 4
-- boi:expect-after select (select count(*) from public.reviews where (slug, md5(content), verdict) in (values ('lego-rontu-the-master-dragon-71842-worth-4999','3fcc1248c4935e6c149edec55e98b6a6','BUY NOW'), ('lego-hagrid-harrys-motorcycle-ride-76443-worth-5449','06e79f7358ea7615d157933b069bb009','WAIT'), ('lego-daily-bugle-76178-worth-39999','04947f76900556f956b7e87671192a32','HUNT IT'))) + (select count(*) from public.news_articles where (slug, md5(content), verdict) in (values ('lego-captain-america-vs-red-hulk-battle-76292-worth-5949','505bd5ea967c239b5026d3cd577544ab','BUY NOW'))) = 4
-- Item 0(d) batch B, regenerated 2 Oct 2026 after 455/455-correction (v1 never reached production). Chat's verdicts; 76178 HUNT IT with its own note.
UPDATE public.reviews SET verdict = 'BUY NOW', content = $c$Ninjago has built entire dragons the size of coffee tables before, so Rontu the Master Dragon ([71842](/sets/71842-rontu-the-master-dragon)) landing at a modest 672 pieces feels almost restrained by comparison — a play-first dragon for the younger end of the fandom, not a display centrepiece.

Let’s get this out of the way: this isn't the epic, display-worthy dragon you might be imagining. Rontu is clearly aimed at the younger Ninjago crowd, designed for play rather than posing. It’s articulated, yes, with posable wings, legs, and tail, but the overall aesthetic is a bit simplified, a bit chunky. The color scheme is striking, a vibrant mix of red, gold, and black, which gives it a certain aggressive presence. The dragon’s head sculpt is decent, with those menacing yellow eyes and a gaping maw.

The build itself is fairly straightforward. At 672 pieces, it’s not going to take you all weekend, which is a plus if you’re impatient or just want to get to the dragon-slaying action. There are some nice building techniques here and there, particularly in how the wings are constructed to allow for decent articulation. The main dragon is accompanied by a small dragon-rider figure, Kai, in his Master Dragon armor. He’s got a decent amount of gear, including two katanas and a buildable glider. There’s also a small buildable wolf figure, which adds a bit of extra value to the set and gives Kai something to fight against.

Where Rontu falters slightly is in its scale and detail compared to its more premium Ninjago dragon brethren. If you’re a collector who’s been picking up the larger Ninjago dragons, this one might feel a bit small and less refined. The dragon’s body, while posable, can look a little thin in places, and the wing articulation, while present, doesn’t quite achieve that majestic swooping look. It’s a good play set, no doubt, but it doesn’t quite hit the mark for an adult fan looking for a centerpiece.

However, for the target audience – kids who love Ninjago and dragons – this set is likely a winner. The play features are solid, the figures are good, and the dragon itself is still pretty cool to swoop around the living room. The price point reflects this more play-oriented design. At ₹4,999, it’s a significant investment, but not an outrageous one for a set of this piece count and theme.

The real question is whether it’s worth it for you. If you’re a Ninjago completionist, or if you have a younger sibling or child who’s obsessed with the theme, then yes, Rontu will likely be a welcome addition. If you’re primarily a display builder, or if you’re looking for a dragon build that truly wows, you might want to consider other options, perhaps older, larger dragons if you can find them, or wait for a sale on this one. The ₹5,499 price at Toycra is a bit steeper, so definitely stick to LEGO.in if you can. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

At ₹4,999 from LEGO.in, that's about 6 months of your favourite streaming service or enough for 20kg of decent Alphonso mangoes. Toycra has it for ₹5,499. LEGO.in | Toycra.

It’s a solid, fun set, but its value proposition is heavily dependent on who’s opening the box. For the younger Ninjago fan, it's a solid "BUY NOW." For the discerning adult collector who prioritizes display aesthetics and complex builds, at 9% under MRP, it's already a fair price. The build is enjoyable, the play features are abundant, and the dragon itself has a certain charm, but it doesn't quite reach the heights of some of LEGO's more ambitious dragon creations. At ₹4,999, you're about 9% under the international MRP, which is a fair price regardless.

Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.

Verdict: BUY NOW.

On that bombshell, bubyee.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Rontu the Master Dragon (71842) price page](/sets/71842-rontu-the-master-dragon).*

*Correction, 2 Oct 2026: an earlier version of this review called this set retired and unavailable in India. It is sold in India — see live prices and stock on the [LEGO Rontu the Master Dragon (71842) price page](/sets/71842-rontu-the-master-dragon).*

Updated 2 Oct 2026: MyBrickHouse's online store is now LEGO.in.$c$ WHERE slug = 'lego-rontu-the-master-dragon-71842-worth-4999' AND verdict = 'RETIRED' AND md5(content) = '0f6dcbff8a8e7a6d10785c928382dbb2';
UPDATE public.reviews SET verdict = 'WAIT', content = $c$The LEGO Harry Potter line has a new entrant, and it’s Hagrid’s iconic motorcycle ride. Set [76443](/sets/76443-hagrid-harrys-motorcycle-ride), officially named Hagrid & Harry's Motorcycle Ride, has landed, and it brings with it a familiar sense of nostalgia for Potterheads. But does this particular trip down memory lane justify its ticket price? That’s the question we need to answer, especially when your hard-earned cash is involved.

This set focuses on the memorable scene where Harry, Hagrid, and a baby Harry are escaping the Dursleys on Hagrid’s flying motorcycle. It’s a pivotal moment early in the series, and LEGO has attempted to capture its essence in brick form. The core of the build is the motorcycle itself, which is a decent size, featuring a sidecar for the passengers. It’s rendered in a classic dark blue, a colour that immediately screams "Hagrid's ride." The detailing here is what you’d expect from a set in this price bracket — not overly complex, but effective enough to be recognizable. The wheels spin, and there’s a small mechanism to allow the motorcycle to "fly" if you want to display it that way, though it’s a bit basic.

Accompanying the motorcycle are the minifigures. We get Harry Potter, both as a baby and as his older self, and Rubeus Hagrid. The baby Harry is a nice touch, allowing for a recreation of that iconic escape scene. Older Harry is standard, and Hagrid is well-represented with his signature beard and attire. The inclusion of Hedwig, the owl, adds another layer of completeness to the set. It’s these figures that will likely draw many fans in, as they are crucial to recreating the narrative. The set also includes a small buildable representation of the Dursleys' house, specifically the cupboard under the stairs where young Harry was forced to live. It’s a small scene, but it effectively sets the context for the escape.

However, the build experience itself isn't exactly groundbreaking. It’s a fairly straightforward assembly, leaning more towards a display piece than an intricate building challenge. For seasoned builders, it might feel a bit on the simpler side. The motorcycle, while visually appealing, doesn't offer many unique building techniques. The sidecar construction is functional, and the connection points for the figures are secure. If you’re buying this primarily for the building process, you might find it a little underwhelming.

The real question for many will be the value proposition. At ₹5,449, it’s not a cheap set. While the minifigure selection is good and the motorcycle is a recognizable icon, the overall piece count and the complexity of the build don’t quite scream "bargain." It feels like you’re paying a premium for the Harry Potter license and the nostalgia factor. There are other LEGO sets in a similar price range that offer more substantial builds or more unique features. This set is definitely for the dedicated Harry Potter fan who wants to own this specific iconic vehicle and scene. Casual builders might find themselves looking elsewhere for better value.

In India, the LEGO Hagrid & Harry's Motorcycle Ride (76443) is available at LEGO.in for ₹5,449. Toycra has it for ₹5,999. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That’s enough for about 10kg of good quality Alphonso mangoes, or roughly three months of your favourite streaming service. LEGO.in and Toycra are the stores to watch.

If you’re a massive Harry Potter fan who wants to recreate this specific moment from the series, and the price isn't a major deterrent, then set 76443 will probably bring you joy. The minifigures are solid, and the motorcycle is an iconic vehicle. However, if you're looking for a more engaging build, a higher piece count for your money, or a set that offers more playability beyond recreating this one scene, you might want to wait for a sale or consider other options. It’s a nice set, but its value is heavily tied to your personal connection to the Harry Potter universe and the specific scene it represents. And at ₹5,449, you're actually about 9% under the international MRP — a real discount, not a tough sell.

Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.

Verdict: WAIT.

On that bombshell, bubyee.

Updated 2 Oct 2026: MyBrickHouse's online store is now LEGO.in.

*Correction, 2 Oct 2026: an earlier version of this review called this set retired and unavailable in India. It is sold in India — see live prices and stock on the [LEGO Hagrid & Harry's Motorcycle Ride (76443) price page](/sets/76443-hagrid-harrys-motorcycle-ride).*$c$ WHERE slug = 'lego-hagrid-harrys-motorcycle-ride-76443-worth-5449' AND verdict = 'RETIRED' AND md5(content) = 'c9f9fadc13eace141e758ad89a6ca43b';
UPDATE public.reviews SET verdict = 'HUNT IT', content = $c$Forty thousand rupees. That’s the kind of number that makes you pause, maybe even question your life choices if you’re staring at a LEGO set. The Daily Bugle ([76178](/sets/76178-daily-bugle)) is one such set. It’s massive, it’s packed with minifigures, and it’s a love letter to comic book fans. But is it a love letter your wallet can afford?

This isn't just a building; it’s a sprawling 3,772-piece recreation of the iconic newspaper office. Standing over 32 inches tall, it’s an imposing display piece that dominates any room. The four-story structure is filled with nods to classic Spider-Man stories, from the street-level New York taxi to the penthouse office of J. Jonah Jameson. Detachable facades and removable floors make it easy to explore the detailed interior, showcasing scenes and characters in their natural habitat. It’s a construction project designed for adults, promising a rewarding build experience and a showstopper display.

What really elevates the Daily Bugle, though, are the minifigures. LEGO has gone all out here, packing in 25 characters from the Spider-Verse. You get your essentials like Spider-Man, Venom, and Miles Morales, but also some deep cuts like Spider-Ham and Gwenpool. Five of these are brand new to the LEGO world: Blade, J. Jonah Jameson himself, Black Cat, Daredevil, and The Punisher. This sheer volume of minifigures alone is a huge draw for collectors, turning the set into a veritable who’s who of the Marvel universe. You even get Spider-Man’s buggy, which is a nice touch.

The build itself is described as challenging but highly rewarding. Given the piece count and the complexity of a four-story building with intricate details, this should keep you engaged for a good few hours. The focus on authentic details and classic comic-book action means there’s always something interesting to discover as you build. It's the kind of set that makes you appreciate the artistry involved in LEGO design, especially when you're creating something as recognizable and beloved as the Daily Bugle.

However, we have to talk about the price. At ₹39,999, this is a significant investment. While the piece count and the sheer number of exclusive minifigures justify a high price, it still puts it firmly in the "major purchase" category for most Indian fans. You could easily get a decent mid-range smartphone or fund several smaller LEGO sets for this amount. It’s a set for the dedicated Marvel fan with a substantial LEGO budget, or someone who’s been saving up for that one truly epic display piece.

Priced at ₹39,999 on Toycra, confirmed in stock as of 9 Sep 2026. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.
Verdict: HUNT IT.

If you’re a die-hard Marvel and Spider-Man fan, and the price doesn’t make you break out in a cold sweat, the Daily Bugle is an absolute must-have. The build experience is solid, the display value is through the roof, and the minifigure selection is phenomenal. But for the casual builder or someone on a tighter budget, the price tag is a significant hurdle. It’s a fantastic set, no doubt, but it demands a serious commitment.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: HUNT IT.

Updated 2 Oct 2026: MyBrickHouse's online store is now LEGO.in.

*Correction, 2 Oct 2026: an earlier version of this review gave "Retired" as its verdict and said the set was no longer available. LEGO has discontinued it and no Indian store has it in stock right now, so our verdict is a buying call: HUNT IT, a great set you'll now mostly find second-hand. If an Indian store lists it again, it shows on the [LEGO Daily Bugle (76178) price page](/sets/76178-daily-bugle).*$c$ WHERE slug = 'lego-daily-bugle-76178-worth-39999' AND verdict = 'RETIRED' AND md5(content) = '4818f8083c018369c9801eb8b536e106';
UPDATE public.news_articles SET verdict = 'BUY NOW', content = $c$Nobody's remortgaging their house for the LEGO Captain America vs. Red Hulk Battle ([76292](/sets/76292-captain-america-vs-red-hulk-battle))? Let's talk. At first glance, it looks like a standard mid-range Marvel set. You get two minifigures, some action-oriented play features, and a build that’s… well, it's a build.

The set promises a showdown between Cap and the big red brute. Captain America comes with his iconic shield, and Red Hulk is, as expected, large and red. The build itself is a sort of arena or battlefield, complete with some exploding elements and maybe a cage. It’s designed for kids, the ones who want to smash things and stage epic battles. And for that, it likely delivers. The articulation on Red Hulk looks decent from the images, which is always a plus for larger figures. Captain America is a staple, and you can never have too many of him, especially if you're building out your Avengers roster.

However, we need to talk about value. This set sits in a price bracket where you start expecting a bit more. More pieces, more detailed builds, or perhaps a more unique minifigure selection. While Red Hulk is cool, and a new Captain America is always welcome, the overall build feels a bit light for the price point. It’s the kind of set that looks fun on the box, and will probably be fun for an hour or two, but will it hold its appeal long-term? That’s the million-dollar question, or in this case, the ₹6,000 question.

The play features, like the exploding wall and the cage, are classic LEGO goodness. They encourage interaction and imaginative play. If you have a younger sibling or child who is a massive Marvel fan, this could be a good gift. But for the seasoned collector, the one who pores over every brick and piece count, this might feel a little… thin. We’re looking at 354 pieces for ₹5,949 at MyBrickHouse. That’s roughly ₹17.6 per piece. When you’re paying over ₹15 per piece, you want that build to be substantial, or the minifigures to be exclusive and highly sought after.

Comparing it to other sets in the ₹5,000–₹7,000 range, it’s hard to say this one stands out. You could potentially get a larger, more complex build from a different theme, or a set with more minifigures and exclusive characters. The appeal here is primarily the specific characters and the battle theme. If you are a die-hard Captain America or Red Hulk fan, or if you need these specific minifigs for a MOC, then the price might be justifiable for you. But for the average LEGO fan looking for a good deal or a compelling build, there might be better options.

The build itself is functional rather than spectacular. It serves its purpose as a backdrop for the minifigure action. It’s not something you’re likely to display prominently on a shelf unless it’s part of a larger Marvel diorama. The colours are vibrant, as expected, with plenty of red for Red Hulk and the arena, and the classic blue and red for Captain America. The inclusion of the cage element is a nice touch, adding another layer to the play possibilities.

Let’s consider the minifigures again. Captain America is a recurring character, so while he’s always good to have, he’s not exactly rare. Red Hulk, however, is a bit more of a draw. Larger figures are always a statement piece. But is one unique figure and one common figure enough to justify the price tag and the relatively small piece count? It’s a tough call.

The build process is likely straightforward and quick, which is good for younger builders but might leave older builders wanting more. There are no particularly complex techniques or surprising building moments. It’s a solid, functional build that gets the job done.

Ultimately, the LEGO Captain America vs. Red Hulk Battle (76292) is a decent set for its intended audience: kids who love Marvel and want to stage action-packed battles. For adult collectors, the value proposition is questionable. You’re paying a premium for the characters and the theme, rather than for a large or intricate build. If you can find it on sale, or if you’re a completionist who absolutely needs Red Hulk, then maybe. Otherwise, it might be wise to wait for a discount.

In India, the LEGO Captain America vs. Red Hulk Battle (76292) is available at MyBrickHouse for ₹5,949. Toycra has it for ₹6,499. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That's enough for about 11 months of Spotify Premium, or enough to buy a decent quality treadmill. MyBrickHouse | Toycra.

This set is a classic example of a licensed theme product. You pay for the brand, the characters, and the play experience. Whether that experience is worth the price is subjective. At ₹5,949 — about 21% over the international MRP — you're within normal India-pricing territory, not paying a scalper's premium. Given the piece count and build complexity, it's a fair price for dedicated fans and casual collectors alike.

Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.

Verdict: BUY NOW.

Verdict: WAIT

On that bombshell, bubyee.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Captain America vs. Red Hulk Battle (76292) price page](/sets/76292-captain-america-vs-red-hulk-battle).*

*Correction, 2 Oct 2026: an earlier version of this review called this set retired and unavailable in India. It is sold in India — see live prices and stock on the [LEGO Captain America vs. Red Hulk Battle (76292) price page](/sets/76292-captain-america-vs-red-hulk-battle).*$c$ WHERE slug = 'lego-captain-america-vs-red-hulk-battle-76292-worth-5949' AND verdict = 'RETIRED' AND md5(content) = '4627700a02a9279a5159c863c05a0fa8';
