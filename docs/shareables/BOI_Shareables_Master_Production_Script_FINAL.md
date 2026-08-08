# BOI Shareables — Master Production Script (FINAL)

**Status:** Locked & Finalized — supersedes both the handoff-brief draft table
(`BOI Shareables — Project Handoff / Continuation Brief`) and the original
codex (`BOI_Shareables_Master_Production_Script.md`, commit `7a94ff0`) as the
single source of truth for creative content. Every clip below was aligned
video-by-video against both prior drafts before locking.

**Technical spec:** unchanged from the handoff brief's Locked Technical
Decisions section — this file governs creative content only (scenes,
captions, prompts, SFX). Render settings, format, hosting, and tooling live
there, not here:
- Kling AI, direct web UI, Pro plan, Professional mode, 1080p
- Output format: MP4, H.264, **1080×1920 (vertical 9:16)**, 4-6s seamless loop, under 5MB
- Caption burned in bottom third, BOI watermark bottom right (~10-15% opacity) — **all in post-production, never Kling-generated**
- SFX: ElevenLabs Sound Effects (Starter plan), event cues only, no voiceover/music
- Same 3-5 reference photos used for every generation

**Sourcing key:** `[D1]` = handoff brief draft · `[D2]` = original codex · `[MERGE]` = combined in alignment session

**Prompting rule enforced throughout:** no Kling prompt below asks the model
to render legible text, URLs, signage, or scores. Every prompt ends with "no
on-screen text." Any text visible in a scene description (URLs, "#1",
year digits, etc.) is a **post-production burn-in only** — see the
Post-Production Notes column.

---

## 1. Flagship Website Intros (3 clips)

### #1 — Clumsy Tech `[D1]` — 10s
- **Scene:** A LEGO minifigure struts confidently toward a laptop on a desk, chest out, chin up. It raises one arm dramatically to press Enter, overreaches, and face-plants flat onto the keyboard. Beat pause.
- **Caption:** "Entrance: 2/10. Website: 10/10. bricksofindia.com"
- **SFX:** Soft thud
- **Kling prompt:** Static camera, medium shot. A LEGO minifigure struts confidently toward a laptop on a desk, chest out, chin up. It raises one arm dramatically to press Enter, overreaches, and face-plants flat onto the keyboard. Beat pause. Toy stop-motion aesthetic, bright even studio lighting, solid color background, smooth deliberate motion, no on-screen text.
- **Post-production notes:** URL "bricksofindia.com" is caption text only, never in-frame.

### #2 — Brick-Finder `[D2, text-fixed]` — 10s
- **Scene:** BOI wields a ridiculous radar scanner searching for the cheapest LEGO prices. The scanner beeps rapidly and triggers a massive avalanche of price tags and bricks. BOI pops out of the pile holding a blank golden sign.
- **Caption:** "Never overpay for LEGO again. www.bricksofindia.com"
- **SFX:** 03s rapid sci-fi radar beeps · 06s plastic brick avalanche · 08s heavenly victory chime
- **Kling prompt:** Macro stop-motion animation, Lego minifigure emerging from a mountain of blocks holding up a glowing golden blank billboard sign, heroic victory pose, dynamic camera zoom, tilt-shift optics, no on-screen text.
- **Post-production notes:** Website URL burned onto the blank sign in post.

### #3 — Magic Reveal `[D2, text-fixed]` — 10s
- **Scene:** BOI wears a magician's hat, waving a micro wand over a black velvet box. *POOF!* A confetti explosion blows his hat off, revealing a blank brick-built banner that unrolls.
- **Caption:** "The magic of LEGO price tracking. www.bricksofindia.com"
- **SFX:** 03s orchestral drumroll · 05s party popper bang · 08s magical shimmer sound
- **Kling prompt:** Charming stop-motion shot, tiny plastic magician character in an oversized top hat blowing off from a huge confetti explosion, unrolling a small blank banner, adorable shocked facial expression, macro photography, no on-screen text.
- **Post-production notes:** Website URL burned onto the blank banner in post.

---

## 2. Festivals (4 clips)

### #4 — Holi `[D2]` — 10s
- **Scene:** BOI confidently adjusts an enormous LEGO colour cannon, serious nod, pulls the lever — nothing. Pulls again — BOOM! It fires backwards, completely engulfing him in pink and yellow powder. He proudly raises both arms.
- **Caption:** "HAPPY HOLI! Somehow, that worked."
- **SFX:** 02s heavy mechanical click · 04s failure squeak · 05s explosive powder blast · 08s victory chime
- **Kling prompt:** Macro stop-motion, Lego minifigure standing covered in explosion of multi-colored dry Holi powder next to a smoking miniature cannon, proud comedic pose, ultra detailed brick textures, colorful dusty atmosphere, no on-screen text.

### #5 — Diwali `[D2]` — 10s
- **Scene:** BOI lights the first diya in a massive arrangement with grand engineer confidence. A chain reaction lights hundreds of diyas in a glowing sea. He beams. One tiny diya beside him quietly goes out; he relights it, it goes out again; he shrugs happily.
- **Caption:** "HAPPY DIWALI! We got most of it working."
- **SFX:** 02s match ignition · 04s rapid magical sparkles · 07s tiny 'pfft' flame out · 09s whimsical chime
- **Kling prompt:** Cozy nighttime stop-motion scene, plastic minifigure lighting miniature clay lamps with glowing flame effects, soft sparkler trails in background, cozy golden bokeh, detailed micro textures, no on-screen text.

### #6 — Christmas `[D1]` — 10s
- **Scene:** A LEGO minifigure carrying fairy lights gets progressively tangled with each step, fully wrapped by the last. Proud arms-out ta-da pose.
- **Caption:** "Wasn't planning to be a gift this year. Here we are. Merry Christmas!"
- **SFX:** Jingle + light rustle
- **Kling prompt:** Static camera, medium shot. A LEGO minifigure carrying fairy lights gets progressively tangled with each step, fully wrapped by the last. Proud arms-out ta-da pose. Toy stop-motion aesthetic, warm festive lighting, solid red/green background, smooth motion, no on-screen text.

### #7 — Eid `[D2]` — 10s
- **Scene:** BOI walks solemnly toward a lavish Eid table with royal grace, spots a massive plate of sweets. Cut to 5s later: the entire feast is untouched, but the sweet plate is entirely empty. He sits at the end of the table looking adorably stuffed and satisfied.
- **Caption:** "EID MUBARAK! The important things were taken care of."
- **SFX:** 02s regal ambient fanfare · 04s rapid cartoon bite pops · 07s satisfied little sigh · 09s peaceful chime
- **Kling prompt:** Stop-motion animation, plastic minifigure sitting blissfully beside an empty plate surrounded by festive lanterns under a glowing crescent moon window, elegant dark blue night background, cute character focus, no on-screen text.

---

## 3. Special / National Occasions (4 clips)

### #8 — Republic Day `[MERGE]` — 10s
- **Scene:** A minifigure snaps into a crisp salute, holding still. A small flag in its other hand droops sideways over a couple seconds. It doesn't break its salute.
- **Caption:** "A flag doesn't have to stand straight to stand for something. Happy Republic Day!"
- **SFX:** 03s soft fabric flutter (flag droop) · 08s held-stillness beat (salute doesn't break)
- **Kling prompt:** Static camera, medium shot, front-facing. A minifigure snaps into a crisp salute, holding still. A small flag in its other hand droops sideways over a couple seconds. It doesn't break its salute. Toy stop-motion aesthetic, bright patriotic lighting, solid tricolor-toned background, smooth minimal motion, no on-screen text.
- **Alignment note:** doc 2's crowd-parade version was rejected for production risk (many figures = higher retry cost against the credit pool); doc 1's single-figure visual/caption kept, doc 2's timestamped-SFX discipline applied.

### #9 — Independence Day `[D2]` — 10s
- **Scene:** BOI attempts to release a massive bundle of tricolor balloons. Instead of releasing them, the buoyancy pulls him off the ground, and he floats upward, casually waving and saluting as he drifts into the bright sunny sky.
- **Caption:** "HAPPY INDEPENDENCE DAY 🇮🇳 Floating into freedom."
- **SFX:** 03s balloon string tension strain · 05s gentle wind swoosh · 08s upbeat celebratory chime
- **Kling prompt:** Whimsical stop-motion animation, minifigure floating upward while holding a bundle of saffron white and green balloons, sunny blue sky backdrop, cheerful patriotic mood, no on-screen text.

### #10 — Ganesh Chaturthi `[D2]` — 10s
- **Scene:** BOI prepares a festive shrine setup — flowers, diyas, perfection. He notices one tiny empty spot and adds a flower. Then another. Then five more. The frame comically overflows with marigolds, forcing him to squeeze into the corner, squished but beaming.
- **Caption:** "GANPATI BAPPA MORYA! We may have overdone the flowers."
- **SFX:** 02s temple bell ring · 04s rapid placement clicks · 07s rustling flower squeeze · 09s celebration chime
- **Kling prompt:** Festive brick stop-motion, plastic minifigure squished into the side of the frame by a giant, overflowing mountain of orange marigold flowers around a golden shrine, warm soft lighting, no on-screen text.

### #11 — Raksha Bandhan `[D2]` — 10s
- **Scene:** BOI presents his sister with a tiny rakhi thread. She smiles. He dramatically reveals a gigantic gift box — she opens it, a smaller box inside; opens that, another smaller box; finally opens the tiniest box: a single chocolate piece. She laughs; he nods like a genius.
- **Caption:** "HAPPY RAKSHA BANDHAN ❤️ The chocolate was always the main event."
- **SFX:** 02s dramatic box opening · 04s escalating pops · 07s tiny squeak box open · 09s satisfied chime
- **Kling prompt:** Warm stop-motion scene, two plastic minifigures surrounded by nesting gift boxes open on the floor, staring at a tiny single piece of chocolate, bright cozy room lighting, heartwarming atmosphere, no on-screen text.

---

## 4. Personal Milestones & Family (6 clips)

### #12 — Mother's Day `[D2]` — 5s
- **Scene:** BOI waddles forward under an absurdly giant brick bouquet five times his size. He reaches Mother mascot, and the entire floral mountain collapses over both of them. A tiny hand emerges from underneath giving a thumbs-up.
- **Caption:** "HAPPY MOTHER'S DAY ❤️ For the one who holds it all together."
- **SFX:** 02s heavy struggling footsteps · 03s soft floral crash sound · 04s warm sparkle chime
- **Kling prompt:** Adorable stop-motion macro, tiny plastic arm sticking out from beneath a giant pile of collapsed colorful LEGO flowers giving a thumbs up, bright warm pastel background, heartwarming comedic mood, no on-screen text.

### #13 — Father's Day `[D2]` — 10s
- **Scene:** BOI unveils an over-engineered LEGO throne for Dad (cup holders, TV, reading light). Dad sits; the chair reclines smoothly into max comfort. Dad gives a thumbs-up, then quietly presses a hidden button — a snack tray pops out. BOI looks at camera in utter awe.
- **Caption:** "HAPPY FATHER'S DAY! Dad deserves the upgrade."
- **SFX:** 02s grand curtain reveal · 04s hydraulic recline hiss · 07s mechanical pop-out · 09s victory fanfare
- **Kling prompt:** Comedic stop-motion, Lego minifigure standing proudly beside a giant luxury reclining armchair built of colorful blocks, dad character lounging inside with a snack tray, bright studio lighting, no on-screen text.

### #14 — Friendship Day `[D2]` — 10s
- **Scene:** Two minifigures march toward each other in dramatic slow motion for an epic high-five. CLACK! Both yellow plastic hands pop clean off. They stare at their detached wrists, look at each other, and bump shoulders instead.
- **Caption:** "HAPPY FRIENDSHIP DAY! Better when we fall apart together."
- **SFX:** 03s slow cinematic footsteps · 06s plastic snapping clack · 08s toy pieces dropping · 09s warm chime
- **Kling prompt:** Upbeat stop-motion scene, two plastic minifigures looking at their detached plastic hands on the floor and bumping shoulders in a hug, star confetti in air, vibrant backdrop, macro focus, no on-screen text.

### #15 — Valentine's Day `[D2]` — 10s
- **Scene:** BOI builds a glowing red heart brick by brick. He places the final central piece, and the entire heart pulses so hard it gently vibrates him across the table.
- **Caption:** "HAPPY VALENTINE'S DAY ❤️ You make my heart vibrate."
- **SFX:** 04s plastic brick click · 07s bass heart thumping pulse · 09s cute slide rattle
- **Kling prompt:** Charming macro stop-motion, Lego minifigure standing next to a pulsing red light brick heart sculpture on a wooden table, dreamy bokeh, warm romantic lighting, no on-screen text.

### #16 — Birthday `[D2]` — 10s
- **Scene:** Dark room. BOI hides behind a banner. A door opens. He leaps out shouting "SURPRISE!" and fires a confetti cannon — it gets stuck ON. More confetti. Cut to 8s: only BOI's head is visible above a room-high mountain of confetti. Tiny wave.
- **Caption:** "HAPPY BIRTHDAY! 🎉 We may have found the button."
- **SFX:** 02s stealthy footsteps · 04s cannon BANG · 06s continuous party horn hiss · 09s squeaky tiny wave
- **Kling prompt:** Festive stop-motion macro, plastic minifigure head peeking out from the very top of a massive pile of colorful confetti that fills the room, holding a party popper, energetic dynamic lighting, no on-screen text.

### #17 — Anniversary `[D2]` — 10s
- **Scene:** Two mascots happily build a LEGO set together. One places a brick; the other immediately moves it. A tiny building disagreement escalates into frantic brick placement — then they stop, look at the finished model, smile, and high-five.
- **Caption:** "HAPPY ANNIVERSARY ❤️ Years later. Still building. Still arguing about the instructions."
- **SFX:** 02s gentle plastic clicks · 05s rapid-fire intense brick snapping · 07s sudden silence / chime · 09s high-five snap
- **Kling prompt:** Charming macro stop-motion, two toy minifigures standing together proudly in front of a detailed LEGO monument they built, holding hands on a wooden desk, warm cozy romantic lighting, no on-screen text.

---

## 5. Everyday BOI (6 clips)

### #18 — Thank You `[D2]` — 5s
- **Scene:** BOI holds up a small sign, decides it's too subtle, flips a giant industrial lever. A giant neon wall behind him lights up. He adjusts his stance proudly.
- **Caption:** "THANK YOU ❤️ Subtlety is overrated."
- **SFX:** 01s tiny sign rattle · 03s heavy industrial switch clunk · 04s stadium light buzz & chime
- **Kling prompt:** Clean stop-motion shot, plastic minifigure standing in front of a giant glowing neon sign wall illuminating the scene, bright studio setup, warm inviting key lighting, no on-screen text.

### #19 — Congratulations `[D2]` — 10s
- **Scene:** BOI stands on a 1st place podium surrounded by fireworks and massive trophies, confused why. He looks down at his neck, sees a tiny "Participant" ribbon, smiles proudly, and raises it to the roaring crowd like Olympic gold.
- **Caption:** "CONGRATULATIONS! 🏆 Obviously, this required a ceremony."
- **SFX:** 02s fireworks blast · 05s crowd cheering roar · 08s ribbon ping sound · 09s triumphant fanfare
- **Kling prompt:** Dynamic stop-motion, minifigure character on a tall podium holding up a tiny medal with a massive gold trophy beside him, golden glitter showering down, bright victory studio lighting, no on-screen text.

### #20 — Good Luck `[D1]` — 5s
- **Scene:** A minifigure studies an instruction manual held upside down, then closes it, firm confident nod, thumbs up.
- **Caption:** "Reading the instructions upside down. Confidence: right side up. Good Luck!"
- **SFX:** Page flip
- **Kling prompt:** Static camera, medium shot. A minifigure studies an instruction manual held upside down, then closes it, firm confident nod, thumbs up. Toy stop-motion aesthetic, bright lighting, solid color background, smooth motion, no on-screen text.

### #21 — Happy Weekend `[D1]` — 5s
- **Scene:** A minifigure reclines in a lounge chair with oversized sunglasses, gives a slow lazy thumbs up without opening its eyes.
- **Caption:** "Chair reclined. Sunglasses oversized. Ambition also reclined. Happy Weekend!"
- **SFX:** Relaxed sigh + chair creak
- **Kling prompt:** Static camera, medium-wide shot. A minifigure reclines in a lounge chair with oversized sunglasses, gives a slow lazy thumbs up without opening its eyes. Toy stop-motion aesthetic, bright relaxed lighting, solid color background, minimal smooth motion, no on-screen text.

### #22 — You Are The Best `[D1]` — 5s
- **Scene:** A minifigure holds a gold trophy piece, buffs it once, admires it, then holds it out directly toward camera.
- **Caption:** "Built an entire trophy just to hand it to you. You Are The Best."
- **SFX:** Trophy shine chime
- **Kling prompt:** Static camera, medium shot. A minifigure holds a gold trophy piece, buffs it once, admires it, then holds it out directly toward camera. Toy stop-motion aesthetic, warm glowing lighting, solid color background, smooth motion, no on-screen text.

### #23 — Love You `[D2]` — 5s
- **Scene:** BOI holds a single red LEGO heart brick and presents it to the camera. The heart glows with warmth, pulsing soft light across his face. A sweet, simple smile.
- **Caption:** "LOVE YOU ❤️"
- **SFX:** 02s soft plastic touch · 03s deep warm heart thud · 04s gentle magical chime
- **Kling prompt:** Charming stop-motion macro, toy minifigure holding out a small glowing red heart brick, soft romantic pink and warm ambient lighting, beautiful shallow depth of field, no on-screen text.

---

## 6. Seasonal & Daily Expressions (4 clips)

### #24 — New Year `[D2]` — 10s
- **Scene:** BOI stands on a rooftop countdown clock. 3... 2... 1... He pulls the giant lever. Nothing. Pulls again, frantic. Still nothing. Terrified look. Suddenly — BOOM! The sky erupts in fireworks. He instantly assumes a smooth pose, pointing up as if he timed it.
- **Caption:** "HAPPY NEW YEAR! 🎆 Right on schedule."
- **SFX:** 03s countdown ticks · 05s lever squeak failure · 07s massive fireworks explosion · 09s midnight celebration cheer
- **Kling prompt:** Festive stop-motion night scene, plastic minifigure on a rooftop with hands on hips, colorful fireworks exploding in dark sky background, cinematic lens flare, no on-screen text.

### #25 — Halloween `[D2]` — 10s
- **Scene:** BOI, dressed as a ghost in a white sheet, jumps out from behind a carved pumpkin shouting "BOO!" Trips on the sheet edge, falls gently into a pile of candy.
- **Caption:** "HAPPY HALLOWEEN! 🎃 Spooky, dangerous, and easily tripped."
- **SFX:** 03s cute high-pitched "Boo!" · 06s candy rattle thud
- **Kling prompt:** Spooky-cute stop-motion, minifigure in a sheet ghost costume lying in a pile of colorful Halloween candy, pumpkin lantern glowing, moody purple lighting, no on-screen text.

### #26 — Good Morning `[D2]` — 5s
- **Scene:** A golden sunrise, birds chirping. BOI emerges from bed, hair wildly messy. Stretches dramatically, looks at the sun, smiles... immediately falls backward flat into bed. One hand creeps out from under the blanket for a thumbs-up.
- **Caption:** "GOOD MORNING ☀️ Technically."
- **SFX:** 02s morning bird chirps · 03s big yawn · 04s bed mattress thud · 05s cute squeak
- **Kling prompt:** Bright morning stop-motion scene, plastic minifigure bed with an arm sticking out giving a thumbs-up from under a blanket, messy hair piece on pillow, warm golden sunrise light, no on-screen text.

### #27 — Good Night & Sweet Dreams `[D2]` — 5s
- **Scene:** BOI climbs into a cozy bed, adjusts his sleep mask, turns off the lamp. Total dark peaceful bliss. A rogue 2x2 LEGO brick falls from the ceiling, taps him softly on the head. CLICK. He sighs peacefully and sleeps anyway.
- **Caption:** "GOOD NIGHT & SWEET DREAMS! Rest well."
- **SFX:** 02s lamp switch click · 04s small plastic 'clack' head impact · 05s soft night lullaby chime
- **Kling prompt:** Cozy night stop-motion shot, minifigure tucked under a brick patterned blanket in a small bed with a sleep mask, cool blue moonlight filtering through window, peaceful atmosphere, no on-screen text.

---

## Duration tally
19 clips at 10s, 8 clips at 5s (#8, #12, #18, #20, #21, #22, #23, #26, #27 minus... see note).
*(Housekeeping note: the handoff brief's own summary text said "20 at 10s, 7 at 5s" but its actual per-clip table shows 19/8 — this file follows the per-clip table, which is what actually governs render/trim settings.)*

## Source tally
5 clips `[D1]` · 21 clips `[D2]` · 1 clip `[MERGE]`

## Still not started (unchanged from handoff brief)
- Kling AI Pro plan — not yet purchased, waiting on this file's approval
- Phase 2 (reference photography) — not started
- Phase 4 (generation) — cannot start until Phase 3 (tool setup) completes
