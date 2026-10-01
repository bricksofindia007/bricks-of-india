-- boi:issue 459
-- boi:backup-tables public.reviews, public.news_articles
-- boi:expect-before select (select count(*) from public.reviews where (slug, md5(content)) in (values ('lego-off-road-police-car-chase-60449-worth-4999','715a7ab2b063053204b1f456bbb62e1c'), ('lego-acclamator-class-assault-ship-75404-worth-5449','5fceb0965379aabd735a5726d17e283c'), ('lego-rontu-the-master-dragon-71842-worth-4999','098817a9730dd9a21498232c659fd86c'), ('lego-revenge-of-the-sith-heroes-villains-40796-worth-5449','308483a2cfff2b10613e9742536daf0c'), ('lego-audi-rs-q-e-tron-42160-worth-17999','9e0e7f1dd00a5cfd066bb845e8f1ee4b'), ('lego-great-deku-tree-77092-worth-20399','afb49986b09ad7fcb8e3eaea4f348246'), ('lego-beekeepers-house-and-flower-garden-42669-worth-10999','096b2833284932f8e9df9f2e35895b10'), ('lego-the-temple-bounty-71848-worth-13739','f5691b9e1f2d7a788c970e354559dd1d'), ('lego-super-mario-world-mario-yoshi-71438-worth-13699','fcd83105f4cf353d123f0f6c7403c20a'), ('lego-nasa-apollo-lunar-roving-vehicle-42182-worth-19199','d6ac6e4910f3faf71a5d17449edf3cfe'), ('lego-fountain-garden-10359-worth-5499','70e14bbce512b9eaec1df94dfd5785b7'), ('lego-eiffel-tower-10307-worth-65999','650773db2b66370f9ae47b18967c7b82'), ('lego-kais-ninja-climber-mech-71812-worth-6399','5502f5e6d4acabfde56099008e6550a0'), ('lego-dragon-stone-shrine-71819-worth-11899','af453b6fe09e46daf5cc367681210045'))) + (select count(*) from public.news_articles where (slug, md5(content)) in (values ('lego-tiger-31217-worth-6399','fb7ccc9f5256149f9a7e1e6d96826553'), ('lego-captain-america-vs-red-hulk-battle-76292-worth-5949','3651b63990aa163f038f61c36996bfb0'), ('lego-the-windmill-farm-21262-worth-5949','a01f012534324d5b8aaddbca4229d10c'))) = 17
-- boi:expect-after select (select count(*) from public.reviews where (slug, md5(content)) in (values ('lego-off-road-police-car-chase-60449-worth-4999','011aa7336750dc96b5dd1cc07c1fcd23'), ('lego-acclamator-class-assault-ship-75404-worth-5449','3f22cf9d9b2edd2faa8910ae8595a1df'), ('lego-rontu-the-master-dragon-71842-worth-4999','d8dfa694c129e4141ecc14c86250b71d'), ('lego-revenge-of-the-sith-heroes-villains-40796-worth-5449','34600624f87c680fd8d240fa39a77fbc'), ('lego-audi-rs-q-e-tron-42160-worth-17999','f0f57fdaa0ebc9cec53cc841323a65d0'), ('lego-great-deku-tree-77092-worth-20399','0c9352692f4118d324245928c99a9e1f'), ('lego-beekeepers-house-and-flower-garden-42669-worth-10999','5b57eae06ebe9215d72fb76c22d045a3'), ('lego-the-temple-bounty-71848-worth-13739','ad584f067da53e460374fe6a22b72177'), ('lego-super-mario-world-mario-yoshi-71438-worth-13699','efabb17d99c132c05057f2a8bb576ff3'), ('lego-nasa-apollo-lunar-roving-vehicle-42182-worth-19199','5443e19accf094a6a7fb67c6a9b9c511'), ('lego-fountain-garden-10359-worth-5499','109e5bc02a5e2720bc82bddd507942a6'), ('lego-eiffel-tower-10307-worth-65999','af4f6b39f1cf816b422351d142e021ba'), ('lego-kais-ninja-climber-mech-71812-worth-6399','dbade8a3bbaca0ca81d2351875564c13'), ('lego-dragon-stone-shrine-71819-worth-11899','76608eea13b9f19e406e44ca4ef490a1'))) + (select count(*) from public.news_articles where (slug, md5(content)) in (values ('lego-tiger-31217-worth-6399','208ee39819d1f3ba3a2eacaa266d5229'), ('lego-captain-america-vs-red-hulk-battle-76292-worth-5949','4627700a02a9279a5159c863c05a0fa8'), ('lego-the-windmill-farm-21262-worth-5949','084aa4f4aa821f495645c76108f62017'))) = 17
-- A4 (P14 round 7, chat-approved wording): 14 reviews + 3 Review articles said a retired set was no longer available in India;
-- all 17 are on sale in India (1 Oct 2026). Corrected in place with a dated note (G16). md5-guarded per row.
UPDATE public.reviews SET content = $c$The LEGO City Off-Road Police Car Chase. Set [60449](/sets/60449-off-road-police-car-chase). It’s here. And honestly, your wallet can probably breathe a sigh of relief for now. This isn't the kind of set that demands immediate attention or causes spontaneous weeping over your credit card statement. It’s… fine. It’s a police chase, with off-road vehicles, because apparently, criminals are now using SUVs to make their getaway from small-town donut shops. The premise itself is a bit of a stretch, but we’ll get to that.

Let’s talk about what you actually get. Two vehicles: a police off-roader and a getaway SUV. The police car looks… like a police car. It’s got the standard police colour scheme, some stickers for lights, and a general sense of duty. It’s functional, I guess. You can probably imagine it speeding across the plains, chasing down nefarious bakers or something equally thrilling. The SUV is a bit more interesting, visually. It’s got that rugged look, presumably designed to navigate the treacherous terrain of a suburban park or perhaps a particularly bumpy patch of pavement. It also comes with some stolen goods, which, knowing LEGO City, are probably just a few overly large gold bars or a suspiciously valuable pizza.

There are also three minifigures: two police officers and one suspect. The officers are kitted out with standard police gear, ready to uphold the law in their surprisingly capable off-road vehicles. The suspect, naturally, looks a bit shifty, probably contemplating their next move or wondering if they remembered to pay their parking tickets. The accessories are minimal – a few tools, some handcuffs, the obligatory stolen loot. Nothing that screams ‘must-have’ or ‘game-changer’ for your collection.

Now, the price. ₹4,999. For what? A police car and an SUV, a few minifigures, and a handful of accessories. It feels steep. Especially when you consider the piece count, which is not exactly overwhelming. You’re paying for the LEGO City branding, the novelty of ‘off-road’ police vehicles, and the sheer joy of recreating a chase scene that probably wouldn't happen outside of a cartoon. It’s the kind of set that, if it were priced closer to ₹3,000, would be a no-brainer for any LEGO City fan. But at nearly five grand? You have to ask yourself if the chase is truly worth the cost.

This set falls into that awkward middle ground. It's not a massive, show-stopping display piece, nor is it a small, affordable impulse buy. It’s a mid-range playset that promises a bit of action but delivers a rather predictable experience. The build itself is likely straightforward, as is typical for LEGO City sets, meaning you'll have it assembled and ready for a chase in no time. But is that quick build and predictable play pattern worth the significant investment? I’m not convinced.

For dedicated LEGO City collectors who simply must have every police-themed set, this might be a checkbox to tick. For everyone else, especially those keeping a keen eye on their budget, there are better ways to spend ₹4,999. You could get a couple of smaller, more interesting sets, or perhaps save up for something truly special. This set feels like it’s priced for a global market and then simply slapped with an Indian price tag, rather than being thoughtfully priced for the local market. It's a chase, alright, but it's a chase for your money that you might want to opt out of.

At ₹4,999, that's 18 months of Spotify Premium or a very generous amount of street food.
MyBrickHouse has it for ₹4,999. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch for Toycra availability.

The off-road aspect is a nice touch, a small attempt to inject some originality into the perennial LEGO City police theme. But it doesn't quite elevate the set beyond the ordinary. The vehicles are decent enough, the minifigures are standard fare, and the play experience is what you'd expect. If you see this on sale, perhaps in a few months when the initial rush dies down and retailers start clearing stock, it might become a more palatable purchase. Until then, I’d recommend waiting this one out. There are better LEGO adventures to be had for your hard-earned rupees.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

Standard disclaimer: this set is retired by LEGO; check the live price page before assuming it's gone. If Indian stores sell out, the secondary market is the remaining option.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Off-Road Police Car Chase (60449) price page](/sets/60449-off-road-police-car-chase).*$c$
  WHERE slug = 'lego-off-road-police-car-chase-60449-worth-4999' AND md5(content) = '715a7ab2b063053204b1f456bbb62e1c';
UPDATE public.reviews SET content = $c$LEGO Star Wars sets rarely earn the word "utilitarian," but the Acclamator-Class Assault Ship ([75404](/sets/75404-acclamator-class-assault-ship)) manages it — grey, blocky, and about as glamorous as a school bus. Which is sort of the point.

This is the Acclamator-class ship from Star Wars: Episode II – Attack of the Clones. You know, the one that ferries clones to Geonosis. A significant ship in lore, sure. But is it a significant LEGO set? That’s the million-credit question, or rather, the ₹5,449 question.

Let’s get the build experience out of the way. It’s LEGO. It clicks. There are instructions. You’ll likely spend a few hours with it, perhaps interrupted by tea breaks or the existential dread of choosing between this and that new Marvel mech. The ship itself is a decent size, not overwhelmingly massive, but substantial enough to feel like a proper display piece. The grey colour scheme is classic Star Wars, and the designers have captured the ship’s chunky, utilitarian aesthetic pretty well.

Now, the minifigures. We get Captain Gregar, two Clone Troopers (Phase I), and two Clone Shock Troopers. Solid inclusions, especially if you're building a Republic army. The Clone Shock Troopers are a nice touch; they add a splash of colour and distinction. Are they enough to justify the price on their own? Probably not, but they sweeten the deal.

The play features are where things get a bit…standard. There are opening cockpits, stud shooters, and some sort of compartment for minifigures. It’s all functional, but nothing revolutionary. You won't find any hidden Easter eggs or complex mechanisms that will blow your mind. It’s a solid, playable ship that will satisfy younger builders and casual fans.

But here’s the rub: the price. At ₹5,449 for 1,660 pieces, it’s not the worst value proposition we’ve seen from LEGO. That’s about ₹3.27 per piece, which is on the higher end for Star Wars, but not astronomical. However, when you consider the ship’s design, it feels a little… uninspired. It’s a lot of grey bricks. While accurate to the source material, it doesn't exactly pop on the shelf. The Acclamator is not exactly the Millennium Falcon or an X-wing. It’s a military transport. And LEGO has translated that into a grey brick box.

Compared to other recent Star Wars releases in a similar price bracket, the Acclamator feels a bit safe. It’s a good set, don’t get me wrong. The minifigures are great, the build is enjoyable, and it’s a piece of Star Wars history. But it lacks that certain je ne sais quoi that makes you want to remortgage your house for it. It’s a set that many fans have wanted, and LEGO delivered. But they delivered it at a price that makes you pause. Is it a must-buy? If you’re a die-hard Republic fan and have cash to burn, absolutely. For the rest of us, it’s a ‘wait for a sale’ kind of set. The grey might be accurate, but it’s also a bit dull, and the price point demands more visual flair or an extra minifigure or two.

In India, the LEGO Acclamator-Class Assault Ship (75404) is available at MyBrickHouse for ₹5,449. Toycra lists it for ₹5,999, but you can use code ABHINAV12 for 12% off on orders above ₹500, bringing it down to ₹5,279. That’s slightly more than a month’s worth of Biryani platters for the whole family. MyBrickHouse | Toycra.

It's a solid addition to any Republic fleet, but the price point and the monochromatic design mean it’s not an immediate must-have for everyone. If you’re on the fence, I’d say hold off. Wait for a discount, or for LEGO to release something that truly makes your wallet weep with joy. As it happens, at ₹5,449 you're already about 9% below the international MRP — this is that discount, quietly.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

Standard disclaimer: this set is retired by LEGO; check the live price page before assuming it's gone. If Indian stores sell out, the secondary market is the remaining option.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Acclamator-Class Assault Ship (75404) price page](/sets/75404-acclamator-class-assault-ship).*$c$
  WHERE slug = 'lego-acclamator-class-assault-ship-75404-worth-5449' AND md5(content) = '5fceb0965379aabd735a5726d17e283c';
UPDATE public.reviews SET content = $c$Ninjago has built entire dragons the size of coffee tables before, so Rontu the Master Dragon ([71842](/sets/71842-rontu-the-master-dragon)) landing at a modest 672 pieces feels almost restrained by comparison — a play-first dragon for the younger end of the fandom, not a display centrepiece.

Let’s get this out of the way: this isn't the epic, display-worthy dragon you might be imagining. Rontu is clearly aimed at the younger Ninjago crowd, designed for play rather than posing. It’s articulated, yes, with posable wings, legs, and tail, but the overall aesthetic is a bit simplified, a bit chunky. The color scheme is striking, a vibrant mix of red, gold, and black, which gives it a certain aggressive presence. The dragon’s head sculpt is decent, with those menacing yellow eyes and a gaping maw.

The build itself is fairly straightforward. At 672 pieces, it’s not going to take you all weekend, which is a plus if you’re impatient or just want to get to the dragon-slaying action. There are some nice building techniques here and there, particularly in how the wings are constructed to allow for decent articulation. The main dragon is accompanied by a small dragon-rider figure, Kai, in his Master Dragon armor. He’s got a decent amount of gear, including two katanas and a buildable glider. There’s also a small buildable wolf figure, which adds a bit of extra value to the set and gives Kai something to fight against.

Where Rontu falters slightly is in its scale and detail compared to its more premium Ninjago dragon brethren. If you’re a collector who’s been picking up the larger Ninjago dragons, this one might feel a bit small and less refined. The dragon’s body, while posable, can look a little thin in places, and the wing articulation, while present, doesn’t quite achieve that majestic swooping look. It’s a good play set, no doubt, but it doesn’t quite hit the mark for an adult fan looking for a centerpiece.

However, for the target audience – kids who love Ninjago and dragons – this set is likely a winner. The play features are solid, the figures are good, and the dragon itself is still pretty cool to swoop around the living room. The price point reflects this more play-oriented design. At ₹4,999, it’s a significant investment, but not an outrageous one for a set of this piece count and theme.

The real question is whether it’s worth it for you. If you’re a Ninjago completionist, or if you have a younger sibling or child who’s obsessed with the theme, then yes, Rontu will likely be a welcome addition. If you’re primarily a display builder, or if you’re looking for a dragon build that truly wows, you might want to consider other options, perhaps older, larger dragons if you can find them, or wait for a sale on this one. The ₹5,499 price at Toycra is a bit steeper, so definitely stick to MyBrickHouse if you can. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

At ₹4,999 from MyBrickHouse, that's about 6 months of your favourite streaming service or enough for 20kg of decent Alphonso mangoes. Toycra has it for ₹5,499. MyBrickHouse | Toycra.

It’s a solid, fun set, but its value proposition is heavily dependent on who’s opening the box. For the younger Ninjago fan, it's a solid "BUY NOW." For the discerning adult collector who prioritizes display aesthetics and complex builds, at 9% under MRP, it's already a fair price. The build is enjoyable, the play features are abundant, and the dragon itself has a certain charm, but it doesn't quite reach the heights of some of LEGO's more ambitious dragon creations. At ₹4,999, you're about 9% under the international MRP, which is a fair price regardless.

Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

Standard disclaimer: this set is retired by LEGO; check the live price page before assuming it's gone. If Indian stores sell out, the secondary market is the remaining option.

On that bombshell, bubyee.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Rontu the Master Dragon (71842) price page](/sets/71842-rontu-the-master-dragon).*$c$
  WHERE slug = 'lego-rontu-the-master-dragon-71842-worth-4999' AND md5(content) = '098817a9730dd9a21498232c659fd86c';
UPDATE public.reviews SET content = $c$Revenge of the Sith turns 20 this year, and LEGO's answer is a five-minifigure display piece rather than a proper set — Anakin, Obi-Wan, Padmé, Grievous, and Vader on a nameplated stand, commemorating the anniversary more than building anything substantial.

The build itself is a compact display piece, designed to showcase a selection of iconic characters. We get Anakin Skywalker in his Jedi Knight attire, Obi-Wan Kenobi, Padmé Amidala, General Grievous, and Darth Vader. The selection is pretty solid, hitting the key players without too many deep cuts. Grievous, in particular, is always a crowd-pleaser, and seeing him alongside the Jedi and Sith Lords offers a nice visual contrast. The figures themselves are standard LEGO minifigure fare, but their inclusion is the main draw here. It’s not about complex building techniques or groundbreaking new elements; it's about the characters and the anniversary.

The display stand is where the set tries to add a bit more value. It’s designed to hold all the minifigures neatly, with little nameplates for each character. This elevates it from just a bag of figs to something you might actually want to put on a shelf. The stand itself is relatively simple, a few plates and bricks, but it serves its purpose well. It’s functional and aesthetically pleasing enough for a desk or a smaller display shelf. For fans of the Revenge of the Sith era, this is a neat way to commemorate the film’s anniversary without requiring a second mortgage.

However, the price is where things get a bit sticky. At ₹5,449, this set is asking a significant amount for what is essentially a collection of minifigures and a basic display stand. While the characters are desirable and the anniversary theme adds a layer of appeal, the actual brick count and building experience are minimal. You’re paying a premium for the IP and the nostalgia factor, which is a common LEGO strategy, but one that can leave you feeling a bit short-changed. Compared to other sets in a similar price bracket that offer substantial builds or unique mechanical features, this one feels light on the actual LEGO construction.

If you’re a die-hard Revenge of the Sith fan and the anniversary means something special to you, then perhaps the price can be justified. The minifigures are well-executed, and the display stand adds a touch of class. It’s a good set for what it is: a character-focused celebration piece. But for the average LEGO fan looking for value in terms of build time and brick quantity, it’s hard to wholeheartedly recommend at this price point. There are larger, more engaging sets available for a similar investment, even if they don’t carry the same specific anniversary weight.

This set feels like it’s aimed squarely at collectors who want to mark the occasion. It’s a display piece, a conversation starter, and a nod to a significant film in the Star Wars saga. The inclusion of Darth Vader, Anakin, Obi-Wan, Padmé, and Grievous means you're getting some of the most iconic characters from that movie. The build itself is quick, and the focus is entirely on the minifigures and their presentation. It's a simple, elegant display, but the cost for that elegance is quite high.

MyBrickHouse has the LEGO Revenge of the Sith Heroes & Villains ([40796](/sets/40796-revenge-of-the-sith-heroes-villains)) for ₹5,449. Toycra has not listed it yet; check Toycra for availability. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. This is roughly the cost of 18 months of Spotify Premium Family Plan.

Ultimately, LEGO has crafted a desirable set for a specific audience. The anniversary theme is well-represented, and the minifigure selection is strong. But the high price for a relatively small build experience means it’s a purchase that requires careful consideration. If you’re a completionist or a massive fan of this particular Star Wars film, you might find the value. For everyone else, it’s probably wise to wait for a sale or a special offer.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

Standard disclaimer: this set is retired by LEGO; check the live price page before assuming it's gone. If Indian stores sell out, the secondary market is the remaining option.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Revenge of the Sith Heroes & Villains (40796) price page](/sets/40796-revenge-of-the-sith-heroes-villains).*$c$
  WHERE slug = 'lego-revenge-of-the-sith-heroes-villains-40796-worth-5449' AND md5(content) = '308483a2cfff2b10613e9742536daf0c';
UPDATE public.reviews SET content = $c$The LEGO Technic Audi RS Q e-tron ([42160](/sets/42160-audi-rs-q-e-tron)) is here, and if you’re a fan of rally cars or just ridiculously over-engineered vehicles, your wallet might be bracing itself. This isn’t a small set, and the ₹17,999 price tag confirms it. We're talking about a serious chunk of change for a model that promises a complex build and a detailed replica. Let's see if the engineering marvel translates into a brick-built marvel, or if it’s just another expensive toy that looks good on paper.

This set aims to recreate the daring Audi RS Q e-tron, the electric-powered Dakar Rally car that tackled some of the world's most brutal terrain. LEGO Technic has a reputation for intricate builds, and this one is no different. It features a working suspension system, which is always a crowd-pleaser in Technic sets. You also get to build the sophisticated drivetrain, including the complex arrangement of gears and motors that simulate the car's electric powertrain. It's designed to show off the inner workings, a hallmark of good Technic models.

The build process itself is, as expected from Technic, a journey. It’s not about slapping bricks together; it’s about following complex instructions, connecting gears, and ensuring everything aligns perfectly. This is where the set shines for the dedicated Technic builder. The sheer number of small parts and the intricate connection points can be both satisfying and, at times, frustrating. If you enjoy the challenge of a detailed mechanical build, you’ll likely find this engaging. The sheer scale of the gearing and the suspension is impressive, and seeing it all come together is a rewarding experience.

However, the final model's appearance is where opinions might diverge. While it’s clearly an Audi RS Q e-tron, the Technic aesthetic can sometimes be a bit blocky. For a set at this price point, some might expect a sleeker, more polished finish. The exposed gears and mechanical elements, while true to the Technic theme, don’t always translate into a visually striking display piece for everyone. It looks like a rally car, yes, but it lacks the smooth curves and aerodynamic lines of its real-world counterpart. It’s more about the engineering than the pure aesthetics, which is a common trade-off in the Technic line.

The set does include some cool functions. The doors open, the steering works, and the suspension is quite robust. For playability, it’s decent, though its size and complexity might make it more of a display piece for many adult fans. The sheer detail in the engine bay and undercarriage is a nod to the real car’s engineering prowess, and LEGO has done a commendable job replicating that complexity in plastic.

In India, the LEGO Audi RS Q e-tron (42160) is available at MyBrickHouse and Toycra for ₹17,999. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That's enough to fill your car's petrol tank for about three months, depending on how much you drive.

Ultimately, the LEGO Audi RS Q e-tron (42160) is a solid Technic set for those who appreciate the engineering and complexity. The build is challenging and rewarding, and the functions are well-implemented. But the price is a significant barrier. For ₹17,999, you're paying a premium for the brand and the intricate mechanics. While it’s a faithful representation of the rally car and offers a great building experience, the final model’s aesthetic might not justify the cost for everyone. If you’re a die-hard Technic fan or an Audi rally enthusiast with a substantial budget, this is a worthy addition. For others, waiting for a sale or considering other Technic sets might be a more sensible approach.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Audi RS Q e-tron (42160) price page](/sets/42160-audi-rs-q-e-tron).*$c$
  WHERE slug = 'lego-audi-rs-q-e-tron-42160-worth-17999' AND md5(content) = '9e0e7f1dd00a5cfd066bb845e8f1ee4b';
UPDATE public.reviews SET content = $c$Your wallet just got a notice from Hyrule, or perhaps the Lost Woods. The LEGO Great Deku Tree, set [77092](/sets/77092-great-deku-tree-2-in-1), is here and it's... a lot. Two builds in one, which sounds like value, but at these prices, you'll be asking yourself if you need two Great Deku Trees or just one really good one. This isn't a casual impulse buy; this is a commitment.

This set gives you two distinct building experiences. First, there's the larger, more detailed version from Ocarina of Time. It's got poseable branches, a hidden compartment, and even a little Korok to cram inside. The build itself is intricate, focusing on replicating the texture and organic shape of the ancient tree. It’s a satisfying process, with plenty of SNOT (Studs Not On Top) techniques to keep things interesting. The designers clearly put thought into how to make plastic look like gnarled wood.

Then, you have the smaller, more stylized version from Breath of the Wild. This one is more abstract, focusing on capturing the essence of the tree rather than its exact form. It’s quicker to build, and frankly, it looks pretty good on a shelf too. The inclusion of the Korok is a nice touch, as is the little base with the Guardian ruins. Having two builds means you can display them side-by-side or choose your favourite to showcase. It’s a clever idea, but it also means you’re essentially buying two sets in one box, and the price reflects that.

The minifigures are a highlight. We get Link in his Ocarina of Time tunic, Mipha, Daruk, Urbosa, Revali, and a Korok. Having the Champions from Breath of the Wild is a solid draw, and the Ocarina of Time Link is a welcome addition for fans of that era. They add a lot of playability and display value to the set, especially if you’re a big Zelda fan. The attention to detail on the Champions' outfits is commendable.

However, the price is where things get tricky. At ₹20,399 from Toycra, it’s still a substantial investment. MyBrickHouse lists it at ₹25,499, which is firmly in ‘think about it for a while’ territory. For that kind of money, you’d expect perfection, and while the set is good, it’s not revolutionary. The Breath of the Wild version, while aesthetically pleasing, is quite small and might feel like an afterthought to some. It’s a tough call for any Zelda fan who isn't independently wealthy.

In India, the LEGO Great Deku Tree (77092) is available at Toycra for ₹20,399. MyBrickHouse has it for ₹25,499. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That's enough for 15kg of good quality Alphonso mangoes, or roughly 12 months of Netflix Premium. Toycra and MyBrickHouse are the stores to watch for this one.

Is it worth it? For the hardcore Zelda fan who has to have everything, probably. The two builds offer variety, the minifigures are excellent, and the Ocarina of Time build is a solid display piece. But for the casual fan or someone watching their budget, that ₹20,399 price tag is a significant hurdle. You’re paying a premium for the IP and the dual-build gimmick. If you can snag it on a good sale, it becomes a much more palatable purchase. Otherwise, you might want to wait for a price drop or consider if one Deku Tree is enough.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Great Deku Tree 2-in-1 (77092) price page](/sets/77092-great-deku-tree-2-in-1).*$c$
  WHERE slug = 'lego-great-deku-tree-77092-worth-20399' AND md5(content) = 'afb49986b09ad7fcb8e3eaea4f348246';
UPDATE public.reviews SET content = $c$Your wallet just got a gentle nudge, not a full-blown panic attack. The LEGO Beekeepers' House and Flower Garden ([42669](/sets/42669-beekeepers-house-and-flower-garden)) has landed, and while it’s not going to bankrupt you, it’s also not exactly a steal. This set offers a sweet little slice of nature-themed building, focusing on a charming beekeeping cottage and a vibrant garden. It’s part of the Friends line, which means bright colours and a focus on storytelling, but LEGO has been smart enough to make this one appealing beyond the usual demographic.

The main build is the beekeeper’s house. It’s a compact structure, designed to be open at the back for easy play access. Inside, you’ll find miniature beekeeping tools, a workstation, and even a little honey-making setup. The exterior is decorated with floral motifs and, of course, those adorable bees. What really makes this set pop, though, is the garden. It’s bursting with colour, featuring various flowers, a small pond, and a bench. The build itself is straightforward, using a mix of standard bricks and some newer, more organic-looking elements to create the flora. It’s the kind of build that’s more about the satisfying placement of colourful pieces than groundbreaking building techniques.

The set comes with three mini-dolls: a beekeeper and two visitors. Each mini-doll is well-designed, with appropriate accessories like hats and gardening tools. The bees themselves are a highlight – small, printed elements that add a lot of character. There’s also a small butterfly and a ladybug, rounding out the nature theme. The play features are standard for the Friends line: the house opens up, the garden elements are posable, and there’s a little cart for transporting honey. It’s designed for interactive play, encouraging kids to create stories around the beekeepers and their garden.

However, the value proposition here is a bit murky. The piece count is relatively low for the price, especially when you consider the size of the main house. While the garden is visually appealing, many of the pieces are small flowers and foliage elements that don't add a huge amount to the overall build complexity. The Friends theme, by its nature, often prioritizes play features and mini-dolls over sheer brick count, and this set is no exception. If you’re a dedicated Friends fan, or specifically looking for a beekeeping-themed set, you might find the charm outweighs the piece-per-rupee cost.

For the general LEGO builder, however, the price point might feel a little steep. The build experience is pleasant but not particularly challenging or innovative. The finished model is attractive, especially the garden, but it’s not a centrepiece display piece in the way some larger, more complex sets can be. It’s more of a charming diorama that’s also playable. The inclusion of printed bee elements is a definite plus, as is the overall aesthetic, but it doesn't quite justify the ₹10,999 price tag from MyBrickHouse.

In India, the LEGO Beekeepers' House and Flower Garden (42669) is available for ₹10,999 at MyBrickHouse and ₹11,999 at Toycra. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That's about enough for three mid-range smartphones or a solid month of eating out. MyBrickHouse | Toycra.

The Verdict: While the Beekeepers' House is a visually pleasing set with a good dose of charm and a satisfying nature theme, the price is a significant hurdle. The piece count doesn't quite align with the cost, meaning you’re paying a premium for the theme and the mini-dolls. It’s a good set, but not a great value. If you can snag it during a sale or from MyBrickHouse at its current price, it might be worth considering. Otherwise, it's probably best to wait for a better deal.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Beekeepers' House and Flower Garden (42669) price page](/sets/42669-beekeepers-house-and-flower-garden).*$c$
  WHERE slug = 'lego-beekeepers-house-and-flower-garden-42669-worth-10999' AND md5(content) = '096b2833284932f8e9df9f2e35895b10';
UPDATE public.reviews SET content = $c$Your wallet blinked. Mine did too. The LEGO Temple Bounty ([71848](/sets/71848-the-temple-bounty)) has landed, and while it's certainly a lot of LEGO, the price is… a conversation starter. This isn't your casual impulse buy; this is a considered purchase, and frankly, the math isn't quite adding up on first glance.

Let's talk about what you get. This set, based on the Ninjago "Dragons Rising" season, gives you a rather substantial pirate ship. It's packed with play features, which is classic Ninjago. We're talking opening cockpits, hidden compartments, poseable dragons, and a decent number of minifigures. The ship itself looks imposing, a good centrepiece for any Ninjago display. The building experience, from what I can gather, is solid. Ninjago sets often strike a good balance between interesting building techniques and the final playability. You get over 1,700 pieces here, which sounds impressive on paper, but when you break it down by the cost, it starts to feel a little thin.

The minifigure selection is, as expected for a Ninjago flagship, quite strong. You get the core ninja team in their updated "Dragons Rising" gear, plus a few villains and a dragon. It's a good haul for anyone looking to populate their Ninjago world. The ship's design is undeniably cool, with a weathered look that suggests it's seen plenty of battles. The sails look decent, and the overall silhouette is striking. It’s a good-looking model that will hold its own on a shelf.

However, the elephant in the room – or rather, the dragon on the ship – is the price. At ₹22,899 from MyBrickHouse and a slightly more palatable ₹13,739 from Toycra, this is a significant investment. Even at the lower Toycra price, you're paying a premium. The piece count, while high, doesn't quite justify the cost when you compare it to other large sets in the market. You can find sets with similar piece counts for considerably less, though perhaps not with the same level of licensing or play features. It’s a classic LEGO dilemma: do you pay for the theme, the minifigures, and the playability, or do you focus purely on the brick-per-rupee ratio?

For the dedicated Ninjago fan, this might be a must-have. The detail and play features are there. The ship is large and impressive. But for the more casual builder or the budget-conscious collector, the price point is a serious hurdle. It feels like one of those sets that will eventually go on sale, and frankly, that's when it will become a much more attractive proposition. The sheer size means it’s not exactly a small thing to store or display either, so consider that space before you commit.

The build itself is likely to be enjoyable, with enough moving parts and interesting sections to keep you engaged for a good few hours. The inclusion of the dragons adds an extra layer of dynamism, and they look well-designed. It’s a set that’s clearly aimed at the younger end of the Ninjago audience, but with enough detail and scale to appeal to adult collectors who appreciate the theme. Still, that price…

In India, the LEGO Temple Bounty (71848) is listed at ₹22,899 on MyBrickHouse and ₹13,739 on Toycra. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That's 12 months of Netflix Premium or enough to buy 30kg of good quality basmati rice. MyBrickHouse | Toycra.

Ultimately, the Temple Bounty is a good set, but it’s not a great value at its current retail price in India. It’s a set that screams "wait for a discount." The build is likely fun, the display value is high, and the minifigures are a bonus. But that price tag means you should probably hold off. There are better deals to be had, or at least, better prices will likely emerge.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO The Temple Bounty (71848) price page](/sets/71848-the-temple-bounty).*$c$
  WHERE slug = 'lego-the-temple-bounty-71848-worth-13739' AND md5(content) = 'f5691b9e1f2d7a788c970e354559dd1d';
UPDATE public.reviews SET content = $c$Your wallet just blinked. LEGO Super Mario World: Mario & Yoshi ([71438](/sets/71438-super-mario-world-mario-yoshi)) is here, and while it brings some beloved characters, the price is… a conversation starter. This set is aimed squarely at fans of the classic Super Mario World era, bringing Mario and his dinosaur pal Yoshi into the buildable world.

Let's talk about the build itself. It’s not a massive undertaking, clocking in at 250 pieces. This is more of a character build and display piece than a complex construction project. You get a decent-sized, brick-built Mario figure and a similarly constructed Yoshi. The design team has done a commendable job capturing the pixelated charm of these characters in LEGO form. Mario's iconic red cap and overalls are well-represented, and Yoshi’s distinctive shape and colour are instantly recognisable. They’ve even included some interactive elements, with the figures featuring printed tiles for their eyes, which can be swapped out for different expressions. This adds a nice touch of personality and customisation, something LEGO fans always appreciate.

The set also includes a small brick-built environment, reminiscent of classic Super Mario World levels. There’s a small green hill section with a coin block and a Super Star. These elements aren’t groundbreaking, but they serve their purpose in grounding the characters within their familiar universe. The playability aspect for those who own the LEGO Super Mario starter sets is there, but this set is primarily for display. If you’re a collector of LEGO Super Mario characters or a huge fan of Super Mario World, the aesthetic appeal will likely outweigh the simplicity of the build.

However, the piece count is low for the price. At ₹13,699 from MyBrickHouse, that's over ₹54 per piece. Even Toycra's ₹10,274 price tag, while better, still puts it around ₹41 per piece. This is on the higher side, even for licensed themes. While the characters are well-executed, the overall construction doesn't justify such a high cost in terms of brick volume or complexity. You're paying a premium for the IP and the specific character designs.

The inclusion of Yoshi is a big draw. He’s a fan favourite, and getting a brick-built version adds significant value for collectors. The articulation on both figures is decent, allowing for some posing options, but don’t expect hyper-realistic movement. They are static builds with some articulation points. The printed eye tiles are a neat feature, adding replayability for display arrangements.

Ultimately, this set feels like a collector's item first and a building experience second. The build is quick, and the result is a charming display piece. But the price point is a major hurdle. If you're deeply invested in the LEGO Super Mario universe and can snag it at a discount, it’s a worthwhile addition. For others, the cost-to-piece ratio might make you hesitate. It’s a solid 3 out of 5 for the set itself, but the value proposition is questionable at full retail.

In India, the LEGO Super Mario World: Mario & Yoshi (71438) is available at MyBrickHouse for ₹13,699. Toycra has it for ₹10,274 — use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That's enough for 11kg of premium Alphonso mangoes or 18 months of Spotify Premium. Given the high price per piece, it's probably best to wait for a significant sale or discount. MyBrickHouse | Toycra.

The decision to buy hinges on your passion for the Super Mario World theme and your tolerance for higher-priced, character-focused sets. If you’re a completionist for the Super Mario line or a die-hard fan of Mario and Yoshi, you’ll likely be happy, even with the cost. For the casual builder or someone more budget-conscious, this is definitely a set to watch for sales. It’s not a bad set, but it’s not a steal either.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Super Mario World: Mario & Yoshi (71438) price page](/sets/71438-super-mario-world-mario-yoshi).*$c$
  WHERE slug = 'lego-super-mario-world-mario-yoshi-71438-worth-13699' AND md5(content) = 'fcd83105f4cf353d123f0f6c7403c20a';
UPDATE public.reviews SET content = $c$The Space Race is back on, and LEGO is taking us all the way to the Moon with the NASA Apollo Lunar Roving Vehicle (LRV). This isn't just another spaceship; it’s a piece of history, a detailed replica of the vehicle that rolled across the lunar surface. But before you start mentally rearranging your display shelf and calculating your EMI, let’s talk about the price. At ₹19,199 for the MyBrickHouse variant, this is a serious investment. Is this lunar rover worth the hefty sum, or is it just another overpriced piece of plastic destined for the grey market?

This set, number 42182, boasts 1,090 pieces. That's a decent count, but not exactly mind-blowing for the price point. What you’re paying for here is the license, the detail, and the sheer novelty of owning a LEGO replica of the LRV. The build process, according to initial reports, is a mix of Technic and System elements, creating a functional model with steerable wheels, articulated suspension, and even a deployable science instrument. The accuracy is commendable, capturing the utilitarian, somewhat rugged look of the original vehicle. It’s clearly designed for display, not for rough play, which is appropriate given its historical significance.

The vehicle itself is quite large when completed, measuring about 40 cm long. It comes with two astronaut minifigures, complete with lunar suits and tools, adding a nice touch of life to the scene. There are also several stickers to apply, which is always a point of contention for some builders, but they are necessary to get the authentic NASA markings. The articulation in the wheels and suspension is a highlight, allowing you to pose the LRV in various ways, simulating its traversal of the lunar terrain. The deployment of the science instrument adds another layer of playability, though again, this is primarily a display piece.

However, the elephant in the room is the price. ₹19,199 is a substantial amount of money for just over a thousand pieces. While the licensing and the detailed design contribute to the cost, it’s hard to ignore the value-per-piece metric. You can get much larger sets with more pieces for a similar or even lower price. This is where the verdict of ‘WAIT’ comes in. This set is undeniably cool, a great addition for any space exploration fan, but the current retail price in India feels a bit steep. It’s likely that we’ll see this set go on sale, or perhaps find it at a slightly better price point through other channels down the line.

The build experience is reported to be engaging, with some clever Technic integrations. The final model looks fantastic, a true representation of the iconic LRV. The inclusion of minifigures and accessories enhances its display value significantly. It’s a set that will undoubtedly appeal to a niche but dedicated audience. If you’re a die-hard Apollo program fan and the price isn't a deterrent, then by all means, go for it. But for the average LEGO fan, especially in India where price sensitivity is high, waiting for a discount is the sensible approach.

In India, the LEGO NASA Apollo Lunar Roving Vehicle ([42182](/sets/42182-nasa-apollo-lunar-roving-vehicle-lrv)) is available at MyBrickHouse for ₹19,199. Toycra has it for ₹20,999. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That's enough to buy about 96 kg of basmati rice or cover three months of unlimited data plans for your entire family. MyBrickHouse and Toycra are the stores to watch for this one.

The set is a strong 4 out of 5 for its design and historical accuracy. It’s a well-executed model that captures the essence of the LRV. The build is intricate and satisfying, and the final product is a worthy display piece. The only thing holding it back from a 'BUY NOW' verdict is the current price in the Indian market. It’s a set that commands a premium, and until that premium comes down a bit, it’s wise to hold off. Keep an eye on deals, and perhaps this lunar relic will land in your collection at a more palatable price.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO NASA Apollo Lunar Roving Vehicle - LRV (42182) price page](/sets/42182-nasa-apollo-lunar-roving-vehicle-lrv).*$c$
  WHERE slug = 'lego-nasa-apollo-lunar-roving-vehicle-42182-worth-19199' AND md5(content) = 'd6ac6e4910f3faf71a5d17449edf3cfe';
UPDATE public.reviews SET content = $c$Your wallet called. It’s asking if you’ve seen the LEGO Fountain Garden ([10359](/sets/10359-fountain-garden)). It’s the latest addition to the Botanical Collection, and while it promises tranquility, it might deliver a different kind of stress. The price is the first thing that hits you, especially when you compare it to other sets in the same genre.

This set is a bit of a paradox. On one hand, it’s undeniably beautiful. The design team has done a commendable job of capturing the serene essence of a Japanese garden. The water features, the meticulously placed rocks, the delicate foliage – it all comes together to create a visually appealing display piece. The build itself is generally relaxing, with repetitive yet satisfying elements that allow you to zone out and just build. It’s the kind of set you can imagine putting on your desk to de-stress after a long day of… well, building LEGO.

The plant elements are a highlight, as expected from the Botanical Collection. There are some interesting pieces used in novel ways to represent the flora. The inclusion of a small pagoda and a stone lantern adds authenticity and character. It’s a set that invites contemplation, a quiet escape in brick form. If you’re a fan of Japanese aesthetics or simply looking for a calming building experience, this set has a lot to offer on paper.

However, the piece count versus the price is where the garden starts to feel a little less serene and a bit more like a financial audit. At 1090 pieces, you're paying over ₹5,000 for what feels like a relatively small final model. While the Botanical Collection is known for its display value rather than sheer brick count, the price-to-piece ratio here feels a little stretched. You’re paying a premium for the specialized elements and the overall aesthetic, which is fair to a degree, but it’s a significant investment for a set that doesn’t offer a massive build or a huge number of unique parts.

Compared to sets like the Bonsai Tree or the Flower Bouquet, the Fountain Garden feels less substantial. Those sets, while also focused on display, felt like you were getting more ‘LEGO’ for your money, or at least a more iconic build. The Fountain Garden is lovely, yes, but it doesn't quite reach that same level of must-have appeal. It’s a niche appeal, certainly, and for those who deeply connect with this specific theme, it might be worth it. But for the average LEGO fan, the price point might be a significant hurdle.

The build experience is smooth, but it doesn't offer many groundbreaking building techniques. It’s more about careful placement and assembly of pre-designed modules. This isn’t necessarily a bad thing; it contributes to the relaxing nature of the build. But if you’re looking for complex SNOT techniques or intricate mechanical elements, you won’t find them here. It’s a straightforward, enjoyable build that prioritizes visual outcome over constructional complexity.

In India, the LEGO Fountain Garden (10359) is available at MyBrickHouse for ₹10,999. Toycra has it for ₹5,499. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That’s 12 months of YouTube Premium or about 50kg of onions. MyBrickHouse | Toycra.

So, should you buy it? If you're a die-hard fan of the Botanical Collection or Japanese gardens, and the price at Toycra doesn't make you flinch, it's a beautiful addition. But for most, the higher price at MyBrickHouse and even the discounted price at Toycra feels a bit steep for the size and piece count. It’s a set that looks better in pictures than it might feel in your hands after you’ve built it, especially considering the cost. Wait for a sale, or perhaps a different Botanical Collection set that offers a bit more bang for your buck.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Fountain Garden (10359) price page](/sets/10359-fountain-garden).*$c$
  WHERE slug = 'lego-fountain-garden-10359-worth-5499' AND md5(content) = '70e14bbce512b9eaec1df94dfd5785b7';
UPDATE public.reviews SET content = $c$Your wallet just went into a panic mode after spotting the price tag on the LEGO Eiffel Tower. Ten thousand plus pieces, a 39 cm tall replica of Paris’s most iconic landmark, and a price that makes you question whether you should splurge on a souvenir or a new TV. The set ([10307](/sets/10307-eiffel-tower)) is marketed as a “building kit for adults”, and the claim isn’t far off – it’s a serious build that rewards patience and a love for architectural detail.

At 10,001 pieces the Eiffel Tower is a marathon rather than a sprint. The build is split into three main sections – the base, the mid‑section, and the delicate top lattice. The instructions are clear, with colour‑coded steps that keep you from mixing up the intricate lattice bars. The part variety is impressive: you’ll find a surprising amount of Technic pins and axles that give the structure extra rigidity, while the majority are classic bricks that stack neatly. For anyone who enjoys a methodical, almost therapeutic construction experience, this set hits the sweet spot.

Design-wise, LEGO has done a commendable job capturing the tower’s silhouette. The final model stands 39 cm tall, roughly the height of a standard kitchen countertop, and the tapering design looks authentic from every angle. The colour palette sticks to the iconic dark grey, with a few subtle accents that make the lattice pop under good lighting. When displayed on a shelf, it becomes a conversation starter – a mini‑Parisian skyline that doesn’t take up floor space.

Value‑for‑pieces is where the set earns its rating. Ten thousand pieces for a single landmark might sound steep, but the piece count is justified by the level of detail and the structural integrity of the finished model. Compared to other architectural sets in the same price bracket, the Eiffel Tower offers a higher piece density and a more challenging build. It’s not a quick‑win set you finish in a weekend; it’s a weekend‑plus project that feels rewarding when the final bolt clicks into place.

The price tag of ₹65,999 is undeniably high for most Indian brick‑fans, but the set’s scarcity in the local market makes it a rare find. MyBrickHouse has it in stock, meaning you can get it today without waiting for an import delay. The price includes a modest 10 % instant discount for HDFC Bank EasyEMI users, which eases the immediate cash outflow a little, but the overall cost remains a significant chunk of a typical monthly budget.

If you’re a collector who already owns a few architectural sets, this Eiffel Tower will elevate your display cabinet. It pairs well with earlier releases like the LEGO Statue of Liberty or the Big Ben, creating a mini‑world of world‑famous monuments. For newcomers, the size and complexity might be intimidating, but the build’s step‑by‑step nature makes it approachable for anyone willing to invest a few evenings.

In short, the LEGO Eiffel Tower delivers on its promises: a faithful replica, a satisfying build, and a respectable piece‑count‑to‑price ratio for those who appreciate architectural detail. The price is steep, but it’s a solid investment for a set that will hold its appeal for years.

Priced at ₹65,999 on MyBrickHouse, confirmed in stock as of 5 Aug 2026.
Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

Standard disclaimer: this set is retired by LEGO; check the live price page before assuming it's gone. If Indian stores sell out, the secondary market is the remaining option.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Eiffel Tower (10307) price page](/sets/10307-eiffel-tower).*$c$
  WHERE slug = 'lego-eiffel-tower-10307-worth-65999' AND md5(content) = '650773db2b66370f9ae47b18967c7b82';
UPDATE public.reviews SET content = $c$Your wallet just breathed a sigh of relief. LEGO Kai's Ninja Climber Mech ([71812](/sets/71812-kais-ninja-climber-mech)) is here, and while it’s not exactly a budget breaker, it’s also not exactly a must-buy either. This set lands squarely in the ‘wait for a sale’ category, especially considering the current Indian pricing.

Let’s talk about the build. It’s a mech. What else do you need to know? You get Kai, fully armoured up, ready to scale walls or punch through enemy lines. The mech stands at a respectable height, and the articulation is decent. It can strike a few dynamic poses, which is always a plus for a mech. The climbing gimmick, with the grappling hooks, is a nice touch, adding a bit of playability beyond just posing. It’s not revolutionary, but it works. The piece count is around 600, which feels about right for the price point, though not exactly generous. You get a few cool weapons and accessories, and the minifigure selection is standard for this wave of Ninjago sets.

The design itself is… fine. It’s a Ninjago mech. It looks like a Ninjago mech. It’s got the usual angular design, the colour scheme is bold, and it’s instantly recognisable as part of the theme. However, it doesn’t quite reach the heights of some of LEGO’s more inspired mech designs. There’s a certain chunkiness to it that feels a little less refined than, say, the recent Spider-Man mech. The climbing function, while functional, does add a bit of bulk that slightly compromises the overall aesthetic. It’s not ugly, by any means, but it’s also not going to be the centrepiece of your display unless you’re a die-hard Ninjago fan.

The play features are where this set tries to shine. The grappling hooks are the main event. You can attach them to various points, and the arms are designed to hold them effectively. It encourages a more active play style, which is great for the target audience. Kai’s mech also comes with a few smaller builds, including a little climbing rig and some enemy figures, which adds to the overall value proposition. It’s a solid set for kids who want to dive straight into imaginative play.

However, when you factor in the Indian pricing, the enthusiasm dampens considerably. At ₹6,399 from MyBrickHouse and ₹6,999 from Toycra, this set feels a bit steep for what you’re getting. It’s a decent-sized mech with a fun gimmick, but it lacks that ‘wow’ factor that would justify a higher price. Compared to other sets in the similar price bracket, it doesn’t offer significantly more value or a more engaging build experience. The Ninjago theme always commands a premium, but this one pushes it a little too far for my liking.

MyBrickHouse has LEGO Kai's Ninja Climber Mech (71812) for ₹6,399. Toycra lists it at ₹6,999. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That price is enough for roughly 17kg of decent Alphonso mangoes or three months of a family Netflix subscription.

For the Ninjago collector, this is a no-brainer. You’ll want Kai’s latest mech for completeness. But for the casual builder or someone looking for the best value, it’s hard to recommend at the current price. There are other mechs, other Ninjago sets, and frankly, other LEGO products that offer a more compelling build or a better price-to-piece ratio. If you can snag this on a significant discount, it might be worth considering. Otherwise, save your rupees for something that truly climbs to the occasion.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Kai's Ninja Climber Mech (71812) price page](/sets/71812-kais-ninja-climber-mech).*$c$
  WHERE slug = 'lego-kais-ninja-climber-mech-71812-worth-6399' AND md5(content) = '5502f5e6d4acabfde56099008e6550a0';
UPDATE public.reviews SET content = $c$Your wallet just breathed a sigh of relief. We're looking at the LEGO Dragon Stone Shrine ([71819](/sets/71819-dragon-stone-shrine-influencer-box)), and while it isn't going to break the bank like some of the UCS monstrosities, it's still a solid chunk of change for what it is. You've got 1,212 pieces here, promising a decent build, but the real question is whether this Ninjago-themed shrine delivers enough magic to justify the price.

Let's talk about the build itself. It’s a Ninjago set, so expect some colourful elements and perhaps a few unique building techniques. The shrine structure looks intricate enough, with its layered design and the central dragon stone element. It’s not exactly a modular building, but it’s more substantial than your average speeder or small character build. The set includes several minifigures, which is always a plus for Ninjago fans looking to populate their displays or engage in some play. We get Kai, Nya, Jay, Master Wu, and a couple of antagonists, Jasper and Evil Wu. The minifigure selection is decent, offering a good mix for those invested in the Ninjago narrative.

The main draw, the dragon stone, is a large, translucent-ish piece that forms the centerpiece. It’s visually striking, and the shrine is built around it to showcase its importance. There are also some nice accessory elements, like the training dummies and the various weapons. The play features seem standard for a Ninjago set of this size – some opening elements, maybe a trap or two, and space to pose the minifigures. It’s designed to be played with, but it also has enough detail to look good on a shelf.

However, the "shrine" aspect feels a bit… generic. While the dragon stone is cool, the surrounding structure doesn't scream "sacred ground" as much as it does "a collection of interesting LEGO bricks arranged together." It lacks a certain gravitas. Compared to some of the more elaborate Ninjago temples or even some of the Creator Expert buildings, this feels a bit less cohesive. The colour palette is vibrant, leaning heavily on reds, oranges, and yellows, which fits the theme but can sometimes make the details a little lost.

The piece count is respectable at 1,212, giving you plenty of brick time. But when you divide that by the Indian price of ₹11,899, you're looking at roughly ₹9.81 per piece. That’s on the higher side for a standard LEGO set, even considering the unique dragon stone element and the minifigures. It’s not astronomical, but it’s certainly not a bargain either. This is where the "WAIT" verdict starts to solidify.

At ₹11,899 from MyBrickHouse, that's enough for two round-trip autorickshaw rides to Goa. Toycra has it for ₹12,999. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect this to be available in Indian stores around the same time as the global launch, with no significant lag.

Ultimately, the LEGO Dragon Stone Shrine (71819) is a competent Ninjago set with a cool central piece and a good minifigure lineup. The build experience is likely solid, as is typical for LEGO. But the price point is a bit steep for what feels like a slightly uninspired design. If you are a die-hard Ninjago fan and absolutely need every new temple, you might find value here. For everyone else, it’s probably best to wait for a sale or a significant price drop. There are better value propositions out there, both within the Ninjago line and across other themes. It’s a decent set, but not one that demands an immediate purchase at full price.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Dragon Stone Shrine Influencer Box (71819) price page](/sets/71819-dragon-stone-shrine-influencer-box).*$c$
  WHERE slug = 'lego-dragon-stone-shrine-71819-worth-11899' AND md5(content) = 'af453b6fe09e46daf5cc367681210045';
UPDATE public.news_articles SET content = $c$This one prowls onto the shelf with a price tag sharp enough to draw blood. Let's talk about the LEGO Tiger ([31217](/sets/31217-tiger)). This is not a casual purchase. This is the kind of set that makes you question your life choices, or at least your spending habits for the next few months. LEGO's Art line has always been for the dedicated, the ones who enjoy a slow burn and a large canvas for their plastic brick obsession. And this tiger? It’s certainly a canvas.

The LEGO Tiger (31217) is part of the Art theme, which means you're not just building a model; you're assembling a piece of wall art. This particular set features a majestic tiger, rendered in LEGO bricks. The source material, as seen on Brickset, shows a detailed, almost photographic representation of the animal. It’s the kind of thing you’d hang above your sofa, or perhaps in your home office to remind you of your commitment to both interior design and your LEGO addiction.

The build process itself is typical for the Art range. You'll be dealing with a lot of small 1x1 tiles and plates, meticulously placed to create the final image. It’s a meditative experience, some might say soothing, others might call it painstakingly tedious. If you’ve ever built one of these sets before, you know what you’re getting into. If you haven’t, imagine assembling a jigsaw puzzle, but with the added satisfaction of knowing you can touch your finished product and it won't fall apart if you breathe on it too hard.

What sets this tiger apart, visually, is the detail. The shading, the textures achieved with different brick types, the intensity in its eyes – it’s remarkable. LEGO has managed to capture the raw power and beauty of a tiger using its most basic elements. It’s proof of the versatility of the brick. However, the Art sets are often a commitment. This one, with its intricate design, is no different.

Now, let's talk about the price. In India, MyBrickHouse has it listed for ₹6,399, while Toycra is slightly higher at ₹6,999. This is a significant investment for a wall decoration, even if it is made of LEGO. Is the artistic merit and the LEGO experience worth this price point? For the die-hard Art collector, perhaps. For the casual builder, it’s a tough pill to swallow. You're paying for the license, the design, and the sheer number of tiny bricks involved in creating this feline masterpiece.

MyBrickHouse has the LEGO Tiger (31217) for ₹6,399, with Toycra at ₹6,999. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That's enough to buy 25kg of good quality basmati rice, or cover your Zomato Gold subscription for about 1.5 years. While these are official prices, the wait for availability can sometimes be a factor.

Compared to other large LEGO sets, this might seem reasonable, but it’s important to remember the target audience for the Art line. These aren't playsets; they are display pieces. If you're looking for something to build and then immediately play with, this isn't it. If you’re looking for a project that results in a striking piece of home decor that also happens to be made of LEGO, then the Tiger might be for you.

However, given the price and the nature of the set – a display piece that doesn’t offer much in terms of interactive play – I’d lean towards recommending a buy. At ₹6,399 via MyBrickHouse, you're already below Toycra's ₹6,999 list price. MyBrickHouse offers the better price, and there's no strong reason to hold out for a sale that may not come.

Verdict: WAIT

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

Standard disclaimer: this set is retired by LEGO; check the live price page before assuming it's gone. If Indian stores sell out, the secondary market is the remaining option.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Tiger (31217) price page](/sets/31217-tiger).*$c$
  WHERE slug = 'lego-tiger-31217-worth-6399' AND md5(content) = 'fb7ccc9f5256149f9a7e1e6d96826553';
UPDATE public.news_articles SET content = $c$Nobody's remortgaging their house for the LEGO Captain America vs. Red Hulk Battle ([76292](/sets/76292-captain-america-vs-red-hulk-battle))? Let's talk. At first glance, it looks like a standard mid-range Marvel set. You get two minifigures, some action-oriented play features, and a build that’s… well, it's a build.

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

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

Standard disclaimer: this set is retired by LEGO; check the live price page before assuming it's gone. If Indian stores sell out, the secondary market is the remaining option.

Verdict: WAIT

On that bombshell, bubyee.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO Captain America vs. Red Hulk Battle (76292) price page](/sets/76292-captain-america-vs-red-hulk-battle).*$c$
  WHERE slug = 'lego-captain-america-vs-red-hulk-battle-76292-worth-5949' AND md5(content) = '3651b63990aa163f038f61c36996bfb0';
UPDATE public.news_articles SET content = $c$The LEGO Windmill Farm ([21262](/sets/21262-the-windmill-farm)) isn't the kind of set that needs an EMI plan. But is it worth the money? That's the real question. This set, released without much fanfare, offers a charming, if somewhat small, slice of countryside life. It’s got a working windmill, which is always a win, and some minifigures to populate the scene. But let's not pretend this is a centerpiece build.

The build itself is straightforward. You get a decent number of pieces for the price, spread across a few numbered bags. The instructions are clear, as you'd expect from LEGO. The windmill mechanism is simple but effective – a gentle spin of the blades is satisfying. It’s the kind of build you can complete in an afternoon, leaving you with a pleasant display piece that evokes a sense of peace. You get two minifigures: a farmer and a baker, along with some accessories like a basket of bread and a pitchfork. The farm buildings are compact, featuring a small barn and the main windmill structure. The color palette is dominated by earthy tones, greens, and whites, which fits the theme perfectly.

Now, let's talk value. The set comes with 830 pieces. For ₹5,949 from MyBrickHouse, that’s about ₹7.17 per piece. If you buy it from Toycra for ₹6,499, it’s closer to ₹7.83 per piece. These aren't astronomical numbers, but they aren't exactly bargain-basement either. Compared to some of the larger, more complex sets LEGO has been churning out, the piece-per-rupee ratio here is respectable. However, the play features are limited, and the overall scale of the final model is modest. It doesn't have the "wow" factor of a massive castle or a detailed cityscape. It’s more of a gentle nod to rural life.

The appeal here is clearly thematic. If you’re a fan of farm sets, pastoral scenes, or just like the idea of a working windmill, then this will tickle your fancy. The minifigures are well-designed, and the accessories add a nice touch of storytelling. It's a set that encourages imaginative play, especially for younger builders or those who appreciate the simpler things. The windmill itself, while basic, is a functional element that adds a dynamic aspect to the display. It’s a set that grows on you, rather than hitting you with an immediate impact.

However, we need to be realistic. For the price, you could potentially find larger sets or sets with more standout features. This is a niche appeal set. It's not going to be the star of your LEGO collection unless you have a specific interest in windmills or rural settings. If you're looking for a set that offers a significant building challenge or a highly interactive play experience, you might want to look elsewhere. The Windmill Farm is more of a charming vignette than an epic adventure.

Consider the competition. There are other farm-themed sets, both past and present, that offer more in terms of size or minifigure count for a similar investment. This set feels a little bit like a missed opportunity to go bigger or add more unique elements. Perhaps a small farmhouse or a cart would have elevated it. As it stands, it's a perfectly nice set, but it doesn't quite justify an immediate purchase at full price.

In India, the LEGO Windmill Farm (21262) is available at MyBrickHouse for ₹5,949 and at Toycra for ₹6,499. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That's roughly 15 months of Spotify Premium. MyBrickHouse | Toycra.

Ultimately, the LEGO Windmill Farm is a solid, pleasant set. It’s well-executed and offers a nice thematic experience. At ₹5,949 via MyBrickHouse, you're actually below Toycra's ₹6,499 — a discount, not a premium. It's a solid, pleasant set worth picking up at this price.

Verdict: WAIT

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.

Standard disclaimer: this set is retired by LEGO; check the live price page before assuming it's gone. If Indian stores sell out, the secondary market is the remaining option.

*Correction, 1 Oct 2026: an earlier version of this review said this set was no longer available in India. LEGO has retired it, but Indian stores may still have stock. See live prices and stock on the [LEGO The Windmill Farm (21262) price page](/sets/21262-the-windmill-farm).*$c$
  WHERE slug = 'lego-the-windmill-farm-21262-worth-5949' AND md5(content) = 'a01f012534324d5b8aaddbca4229d10c';
