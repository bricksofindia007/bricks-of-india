-- boi:issue 496
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where slug = 'lego-ideas-21365-love-birds-worth-5499' and md5(content) = '27196abd03f8f4590018e5a8c40cc3e3' = 1
-- boi:expect-after select count(*) from public.reviews where slug = 'lego-ideas-21365-love-birds-worth-5499' and md5(content) = '3d2046ae9cc2813dbb1678294e2d5493' = 1
-- G19 (chat, round 8 continued): the review narrated its source (named a third-party guest reviewer, "the reviewer also
-- showcases", "is described as"). Reworded in BOI's voice; no fact changes, so no dated note (chat's rule).
UPDATE public.reviews SET content = $c$The LEGO Ideas platform has a knack for turning fan creations into official sets, and [21365](/sets/21365-love-birds) Love Birds is the latest to grace our shelves. It’s a decent-sized display piece, which is always a plus. But let’s talk about the elephant in the room, or rather, the price tag. ₹5,499 for this? Your wallet might need a moment to recover.

This set comes from a January 2026 release, and we finally have a look at it. The core of the build is a pair of rather charming lovebirds perched on a branch. They’re rendered in a pleasing gradient of colours, and the overall aesthetic is quite appealing for a display shelf. It includes parts in a new warm pink colour. This is always exciting for builders looking to expand their palette for custom creations. The build itself is relatively straightforward, with some interesting techniques used to achieve the organic shapes of the birds and their perch. It’s not an overly complex build, which can be good or bad depending on your preference. For those who like a quick and satisfying build, this will hit the spot. If you’re after a technical challenge, you might find it a bit on the simpler side.

The set also includes a small diorama base, featuring some tree elements and what looks like a vibrant coral starfish. This adds a nice touch of environment to the main subject. The recoloured parts have already inspired a couple of MOCs (My Own Creations). This really speaks to the set's potential beyond its intended purpose. The new warm pink pieces, in particular, seem to be a hit for custom builders, opening up new possibilities for organic MOCs, whether it's trees, flowers, or even more abstract sculptures. It’s this versatility that often elevates an Ideas set from a simple model to a valuable parts pack for the creative builder.

Now, about that price. ₹5,499 is a significant investment for what is essentially a display model with a moderate piece count. While the unique recoloured parts add value for MOC builders, for the average fan just looking to complete the set, it feels a bit steep. We’ve seen larger and more complex sets from the Ideas line that offered better value for money.

In India, the LEGO Ideas 21365 Love Birds is available at MyBrickHouse for ₹5,499, though it may be out of stock. That's enough to buy about 11kg of decent mangoes or two months of a Netflix Premium subscription. Toycra and Flipkart have not listed it yet. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra (we earn a commission). With no other options readily available, and considering the price, it’s wise to wait for a potential sale or restock.

The build quality and design are definitely there. The lovebirds are undeniably cute, and the organic shapes are well-executed. The inclusion of new parts is a definite plus for the MOC community. However, the price point is a sticking point. It sits in that awkward territory where it’s not prohibitively expensive like some of the largest UCS sets, but it’s also not cheap enough to be an impulse buy for everyone. You’re paying a premium for the Ideas branding and those specific recoloured pieces.

If you’re a collector of LEGO Ideas sets, or if the warm pink pieces are calling your name for your next MOC project, then this set might be worth the investment, especially if you can snag it on sale. For others, it might be a case of admiring from afar or waiting for a significant price drop. The set itself is good, but the value proposition at its current Indian price is debatable.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.$c$ WHERE slug = 'lego-ideas-21365-love-birds-worth-5499' AND md5(content) = '27196abd03f8f4590018e5a8c40cc3e3';
