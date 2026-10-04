-- boi:issue 246
-- boi:backup-tables public.reviews
-- boi:expect-before select (select count(*) from public.reviews where slug = 'lego-101-dalmatians-puppy-43269-worth-12399' and position('While it boasts 1,153 pieces,' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-10316-rivendell-review' and position('₹40,319 at Toycra, ₹10,080 under MRP. Verdict: BUY.' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-77264-jaguar-f-type-project-7-land-rover-defender-class' and position('packs in 740 pieces' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-arctic-polar-express-train-60470-worth-23900' and position('clocking in at 1,174 pieces' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-autumn-cottage-garden-11372-worth-8999' and position('clocking in at around 1,500 pieces' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-avengers-tower-76269-worth-39199' and position('At 5,201 pieces' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-bmw-m3-e30-77263-worth-2900' and position('At ₹2,900, this isn' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-chevrolet-corvette-stingray-42205-worth-6399' and position('This is a 1,210-piece replica' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-city-police-train-heist-60508-19999-for-a-cat-and-mouse' and position('

BUY NOW
On that bombshell' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-creative-flower-shop-42693-worth-2999' and position('

BUY NOW
On that bombshell' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-dungeons-dragons-red-dragons-tale-21348-worth-35999' and position('It’s a BUY NOW if you have the disposable income' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-ferrari-sf-24-f1-car-42207-worth-18319' and position('At 4,158 pieces,' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-rontu-the-master-dragon-71842-worth-4999' and position('landing at a modest 672 pieces' in content) > 0) = 13
-- boi:expect-after select (select count(*) from public.reviews where slug = 'lego-101-dalmatians-puppy-43269-worth-12399' and position('While it boasts 1,153 pieces,' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-10316-rivendell-review' and position('₹40,319 at Toycra, ₹10,080 under MRP. Verdict: BUY.' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-77264-jaguar-f-type-project-7-land-rover-defender-class' and position('packs in 740 pieces' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-arctic-polar-express-train-60470-worth-23900' and position('clocking in at 1,174 pieces' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-autumn-cottage-garden-11372-worth-8999' and position('clocking in at around 1,500 pieces' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-avengers-tower-76269-worth-39199' and position('At 5,201 pieces' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-bmw-m3-e30-77263-worth-2900' and position('At ₹2,900, this isn' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-chevrolet-corvette-stingray-42205-worth-6399' and position('This is a 1,210-piece replica' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-city-police-train-heist-60508-19999-for-a-cat-and-mouse' and position('

BUY NOW
On that bombshell' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-creative-flower-shop-42693-worth-2999' and position('

BUY NOW
On that bombshell' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-dungeons-dragons-red-dragons-tale-21348-worth-35999' and position('It’s a BUY NOW if you have the disposable income' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-ferrari-sf-24-f1-car-42207-worth-18319' and position('At 4,158 pieces,' in content) > 0) + (select count(*) from public.reviews where slug = 'lego-rontu-the-master-dragon-71842-worth-4999' and position('landing at a modest 672 pieces' in content) > 0) = 0
-- Round 11 (chat, 4 Oct 2026): body edits on 13 reviews (23 edits): piece counts, duplicate or
-- contradictory verdict lines, old MRP figures. Each review gets one dated correction note.
UPDATE public.reviews SET content = replace(content, 'While it boasts 1,153 pieces,', 'While it boasts 1,722 pieces,') || '

*Correction (4 October 2026): an earlier version of this review gave the wrong piece count; it now matches the official count.*' WHERE slug = 'lego-101-dalmatians-puppy-43269-worth-12399' AND position('While it boasts 1,153 pieces,' in content) > 0;
UPDATE public.reviews SET content = replace(content, '₹40,319 at Toycra, ₹10,080 under MRP. Verdict: BUY.', '₹40,319 at Toycra, ₹10,080 under MRP.') || '

*Correction (4 October 2026): an earlier version of this review had a second verdict line that contradicted the verdict; that line was removed.*' WHERE slug = 'lego-10316-rivendell-review' AND position('₹40,319 at Toycra, ₹10,080 under MRP. Verdict: BUY.' in content) > 0;
UPDATE public.reviews SET content = replace(replace(replace(content, 'packs in 740 pieces', 'packs in 747 pieces'), 'At an official Indian MRP of ₹5,400,', 'At an official Indian MRP of ₹5,999,'), 'At ₹5,400 (MRP),', 'At ₹5,999 (MRP),') || '

*Correction (4 October 2026): an earlier version of this review gave the wrong piece count; it now matches the official count; it also gave an old figure as LEGO''s Indian MRP; it now gives the current MRP.*' WHERE slug = 'lego-77264-jaguar-f-type-project-7-land-rover-defender-class' AND position('packs in 740 pieces' in content) > 0 AND position('At an official Indian MRP of ₹5,400,' in content) > 0 AND position('At ₹5,400 (MRP),' in content) > 0;
UPDATE public.reviews SET content = replace(content, 'clocking in at 1,174 pieces', 'clocking in at 1,525 pieces') || '

*Correction (4 October 2026): an earlier version of this review gave the wrong piece count; it now matches the official count.*' WHERE slug = 'lego-arctic-polar-express-train-60470-worth-23900' AND position('clocking in at 1,174 pieces' in content) > 0;
UPDATE public.reviews SET content = replace(content, 'clocking in at around 1,500 pieces', 'clocking in at around 1,100 pieces') || '

*Correction (4 October 2026): an earlier version of this review gave the wrong piece count; it now matches the official count.*' WHERE slug = 'lego-autumn-cottage-garden-11372-worth-8999' AND position('clocking in at around 1,500 pieces' in content) > 0;
UPDATE public.reviews SET content = replace(replace(replace(content, 'At 5,201 pieces', 'At 5,202 pieces'), 'this is probably a BUY NOW.', 'this is probably worth it.'), '

Verdict: WAIT. Good set, but the price will drop.', '') || '

*Correction (4 October 2026): an earlier version of this review gave the wrong piece count; it now matches the official count; it also had a second verdict line that contradicted the verdict; that line was removed.*' WHERE slug = 'lego-avengers-tower-76269-worth-39199' AND position('At 5,201 pieces' in content) > 0 AND position('this is probably a BUY NOW.' in content) > 0 AND position('

Verdict: WAIT. Good set, but the price will drop.' in content) > 0;
UPDATE public.reviews SET content = replace(replace(replace(content, 'At ₹2,900, this isn', 'At ₹2,999, this isn'), 'has an official MRP of ₹2,900', 'has an official MRP of ₹2,999'), 'For ₹2,900, you', 'For ₹2,999, you') || '

*Correction (4 October 2026): an earlier version of this review gave an old figure as LEGO''s Indian MRP; it now gives the current MRP.*' WHERE slug = 'lego-bmw-m3-e30-77263-worth-2900' AND position('At ₹2,900, this isn' in content) > 0 AND position('has an official MRP of ₹2,900' in content) > 0 AND position('For ₹2,900, you' in content) > 0;
UPDATE public.reviews SET content = replace(replace(content, 'This is a 1,210-piece replica', 'This is a 732-piece replica'), 'staring down over 1,200 pieces', 'staring down over 700 pieces') || '

*Correction (4 October 2026): an earlier version of this review gave the wrong piece count; it now matches the official count.*' WHERE slug = 'lego-chevrolet-corvette-stingray-42205-worth-6399' AND position('This is a 1,210-piece replica' in content) > 0 AND position('staring down over 1,200 pieces' in content) > 0;
UPDATE public.reviews SET content = replace(replace(content, '

BUY NOW
On that bombshell', '

On that bombshell'), '

Verdict: WAIT. Good set, but the price will drop.', '') || '

*Correction (4 October 2026): an earlier version of this review had a second verdict line that contradicted the verdict; that line was removed.*' WHERE slug = 'lego-city-police-train-heist-60508-19999-for-a-cat-and-mouse' AND position('

BUY NOW
On that bombshell' in content) > 0 AND position('

Verdict: WAIT. Good set, but the price will drop.' in content) > 0;
UPDATE public.reviews SET content = replace(content, '

BUY NOW
On that bombshell', '

On that bombshell') || '

*Correction (4 October 2026): an earlier version of this review had a second verdict line that contradicted the verdict; that line was removed.*' WHERE slug = 'lego-creative-flower-shop-42693-worth-2999' AND position('

BUY NOW
On that bombshell' in content) > 0;
UPDATE public.reviews SET content = replace(replace(content, 'It’s a BUY NOW if you have the disposable income', 'It’s worth it if you have the disposable income'), 'Bubyee.

Verdict: WAIT.
', 'Bubyee.
') || '

*Correction (4 October 2026): an earlier version of this review had a second verdict line that contradicted the verdict; that line was removed.*' WHERE slug = 'lego-dungeons-dragons-red-dragons-tale-21348-worth-35999' AND position('It’s a BUY NOW if you have the disposable income' in content) > 0 AND position('Bubyee.

Verdict: WAIT.
' in content) > 0;
UPDATE public.reviews SET content = replace(content, 'At 4,158 pieces,', 'At 1,361 pieces,') || '

*Correction (4 October 2026): an earlier version of this review gave the wrong piece count; it now matches the official count.*' WHERE slug = 'lego-ferrari-sf-24-f1-car-42207-worth-18319' AND position('At 4,158 pieces,' in content) > 0;
UPDATE public.reviews SET content = replace(replace(content, 'landing at a modest 672 pieces', 'landing at a modest 381 pieces'), 'At 672 pieces, it’s not going', 'At 381 pieces, it’s not going') || '

*Correction (4 October 2026): an earlier version of this review gave the wrong piece count; it now matches the official count.*' WHERE slug = 'lego-rontu-the-master-dragon-71842-worth-4999' AND position('landing at a modest 672 pieces' in content) > 0 AND position('At 672 pieces, it’s not going' in content) > 0;
