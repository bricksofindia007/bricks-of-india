#!/usr/bin/env python3
"""
BOI Shareables — manifest builder.

Transcribes the 27 locked clip entries from
docs/shareables/BOI_Shareables_Master_Production_Script_FINAL.md into a
single manifest.json consumed by both the Phase 5 post-production script
(postprocess.py) and the Phase 7 Next.js /shareables route. Neither
consumer hardcodes per-clip creative data -- this file is the one place
that does, and it exists specifically so that data lives in one
reviewable, versioned spot instead of being duplicated across a Python
script and a TypeScript route.

Creative content (scene, caption, sfx_cues, kling_prompt,
post_production_notes, alignment_note) is transcribed verbatim from the
FINAL doc -- it is LOCKED per Phase 1 and must not be edited here without
updating the FINAL doc first (and vice versa).

Non-creative fields (loop_trim, assets paths, output/caption/watermark
specs) are technical scaffolding for Phases 5/7 and ARE placeholders --
loop_trim in particular must be re-tuned per clip once real Kling footage
exists, to find the actual seamless loop point.

Usage:
  python build_manifest.py            # writes manifest.json next to this file
"""

from __future__ import annotations

import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent
OUTPUT_PATH = BASE_DIR / "manifest.json"
SOURCE_DOC = "docs/shareables/BOI_Shareables_Master_Production_Script_FINAL.md"


def slugify(name: str) -> str:
    s = name.lower()
    s = s.replace("&", "and")
    s = re.sub(r"['’]", "", s)      # strip apostrophes (Mother's -> Mothers)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def sfx(raw: str) -> list[dict]:
    """Parses an SFX bullet string into structured cues.

    Timestamped cues look like "03s rapid sci-fi radar beeps" and are
    split on " · ". Untimed single-cue clips (5 of the 27 -- all [D1]
    sourced) have no leading digits; those get timestamp_s: null and are
    placed at the post-processor's discretion (documented in
    postprocess.py / README.md)."""
    cues = []
    for part in raw.split(" · "):
        part = part.strip()
        m = re.match(r"^(\d+)s\s+(.*)$", part)
        if m:
            cues.append({"timestamp_s": int(m.group(1)), "description": m.group(2)})
        else:
            cues.append({"timestamp_s": None, "description": part})
    return cues


# Transcribed verbatim from the FINAL doc's 27 clip entries, in document order.
CLIPS = [
    dict(id=1, occasion="Clumsy Tech", category="Flagship Website Intros", source_tag="D1", raw_duration_s=10,
         caption="Entrance: 2/10. Website: 10/10. bricksofindia.com",
         scene="A LEGO minifigure struts confidently toward a laptop on a desk, chest out, chin up. It raises one arm dramatically to press Enter, overreaches, and face-plants flat onto the keyboard. Beat pause.",
         kling_prompt="Static camera, medium shot. A LEGO minifigure struts confidently toward a laptop on a desk, chest out, chin up. It raises one arm dramatically to press Enter, overreaches, and face-plants flat onto the keyboard. Beat pause. Toy stop-motion aesthetic, bright even studio lighting, solid color background, smooth deliberate motion, no on-screen text.",
         post_production_notes='URL "bricksofindia.com" is caption text only, never in-frame.',
         alignment_note=None, sfx="Soft thud"),
    dict(id=2, occasion="Brick-Finder", category="Flagship Website Intros", source_tag="D2, text-fixed", raw_duration_s=10,
         caption="Never overpay for LEGO again. www.bricksofindia.com",
         scene="BOI wields a ridiculous radar scanner searching for the cheapest LEGO prices. The scanner beeps rapidly and triggers a massive avalanche of price tags and bricks. BOI pops out of the pile holding a blank golden sign.",
         kling_prompt="Macro stop-motion animation, Lego minifigure emerging from a mountain of blocks holding up a glowing golden blank billboard sign, heroic victory pose, dynamic camera zoom, tilt-shift optics, no on-screen text.",
         post_production_notes="Website URL burned onto the blank sign in post.",
         alignment_note=None, sfx="03s rapid sci-fi radar beeps · 06s plastic brick avalanche · 08s heavenly victory chime"),
    dict(id=3, occasion="Magic Reveal", category="Flagship Website Intros", source_tag="D2, text-fixed", raw_duration_s=10,
         caption="The magic of LEGO price tracking. www.bricksofindia.com",
         scene="BOI wears a magician's hat, waving a micro wand over a black velvet box. POOF! A confetti explosion blows his hat off, revealing a blank brick-built banner that unrolls.",
         kling_prompt="Charming stop-motion shot, tiny plastic magician character in an oversized top hat blowing off from a huge confetti explosion, unrolling a small blank banner, adorable shocked facial expression, macro photography, no on-screen text.",
         post_production_notes="Website URL burned onto the blank banner in post.",
         alignment_note=None, sfx="03s orchestral drumroll · 05s party popper bang · 08s magical shimmer sound"),
    dict(id=4, occasion="Holi", category="Festivals", source_tag="D2", raw_duration_s=10,
         caption="HAPPY HOLI! Somehow, that worked.",
         scene="BOI confidently adjusts an enormous LEGO colour cannon, serious nod, pulls the lever — nothing. Pulls again — BOOM! It fires backwards, completely engulfing him in pink and yellow powder. He proudly raises both arms.",
         kling_prompt="Macro stop-motion, Lego minifigure standing covered in explosion of multi-colored dry Holi powder next to a smoking miniature cannon, proud comedic pose, ultra detailed brick textures, colorful dusty atmosphere, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="02s heavy mechanical click · 04s failure squeak · 05s explosive powder blast · 08s victory chime"),
    dict(id=5, occasion="Diwali", category="Festivals", source_tag="D2", raw_duration_s=10,
         caption="HAPPY DIWALI! We got most of it working.",
         scene="BOI lights the first diya in a massive arrangement with grand engineer confidence. A chain reaction lights hundreds of diyas in a glowing sea. He beams. One tiny diya beside him quietly goes out; he relights it, it goes out again; he shrugs happily.",
         kling_prompt="Cozy nighttime stop-motion scene, plastic minifigure lighting miniature clay lamps with glowing flame effects, soft sparkler trails in background, cozy golden bokeh, detailed micro textures, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="02s match ignition · 04s rapid magical sparkles · 07s tiny 'pfft' flame out · 09s whimsical chime"),
    dict(id=6, occasion="Christmas", category="Festivals", source_tag="D1", raw_duration_s=10,
         caption="Wasn't planning to be a gift this year. Here we are. Merry Christmas!",
         scene="A LEGO minifigure carrying fairy lights gets progressively tangled with each step, fully wrapped by the last. Proud arms-out ta-da pose.",
         kling_prompt="Static camera, medium shot. A LEGO minifigure carrying fairy lights gets progressively tangled with each step, fully wrapped by the last. Proud arms-out ta-da pose. Toy stop-motion aesthetic, warm festive lighting, solid red/green background, smooth motion, no on-screen text.",
         post_production_notes=None, alignment_note=None, sfx="Jingle + light rustle"),
    dict(id=7, occasion="Eid", category="Festivals", source_tag="D2", raw_duration_s=10,
         caption="EID MUBARAK! The important things were taken care of.",
         scene="BOI walks solemnly toward a lavish Eid table with royal grace, spots a massive plate of sweets. Cut to 5s later: the entire feast is untouched, but the sweet plate is entirely empty. He sits at the end of the table looking adorably stuffed and satisfied.",
         kling_prompt="Stop-motion animation, plastic minifigure sitting blissfully beside an empty plate surrounded by festive lanterns under a glowing crescent moon window, elegant dark blue night background, cute character focus, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="02s regal ambient fanfare · 04s rapid cartoon bite pops · 07s satisfied little sigh · 09s peaceful chime"),
    dict(id=8, occasion="Republic Day", category="Special / National Occasions", source_tag="MERGE", raw_duration_s=10,
         caption="A flag doesn't have to stand straight to stand for something. Happy Republic Day!",
         scene="A minifigure snaps into a crisp salute, holding still. A small flag in its other hand droops sideways over a couple seconds. It doesn't break its salute.",
         kling_prompt="Static camera, medium shot, front-facing. A minifigure snaps into a crisp salute, holding still. A small flag in its other hand droops sideways over a couple seconds. It doesn't break its salute. Toy stop-motion aesthetic, bright patriotic lighting, solid tricolor-toned background, smooth minimal motion, no on-screen text.",
         post_production_notes=None,
         alignment_note="doc 2's crowd-parade version was rejected for production risk (many figures = higher retry cost against the credit pool); doc 1's single-figure visual/caption kept, doc 2's timestamped-SFX discipline applied.",
         sfx="03s soft fabric flutter (flag droop) · 08s held-stillness beat (salute doesn't break)"),
    dict(id=9, occasion="Independence Day", category="Special / National Occasions", source_tag="D2", raw_duration_s=10,
         caption="HAPPY INDEPENDENCE DAY \U0001F1EE\U0001F1F3 Floating into freedom.",
         scene="BOI attempts to release a massive bundle of tricolor balloons. Instead of releasing them, the buoyancy pulls him off the ground, and he floats upward, casually waving and saluting as he drifts into the bright sunny sky.",
         kling_prompt="Whimsical stop-motion animation, minifigure floating upward while holding a bundle of saffron white and green balloons, sunny blue sky backdrop, cheerful patriotic mood, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="03s balloon string tension strain · 05s gentle wind swoosh · 08s upbeat celebratory chime"),
    dict(id=10, occasion="Ganesh Chaturthi", category="Special / National Occasions", source_tag="D2", raw_duration_s=10,
         caption="GANPATI BAPPA MORYA! We may have overdone the flowers.",
         scene="BOI prepares a festive shrine setup — flowers, diyas, perfection. He notices one tiny empty spot and adds a flower. Then another. Then five more. The frame comically overflows with marigolds, forcing him to squeeze into the corner, squished but beaming.",
         kling_prompt="Festive brick stop-motion, plastic minifigure squished into the side of the frame by a giant, overflowing mountain of orange marigold flowers around a golden shrine, warm soft lighting, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="02s temple bell ring · 04s rapid placement clicks · 07s rustling flower squeeze · 09s celebration chime"),
    dict(id=11, occasion="Raksha Bandhan", category="Special / National Occasions", source_tag="D2", raw_duration_s=10,
         caption="HAPPY RAKSHA BANDHAN ❤️ The chocolate was always the main event.",
         scene="BOI presents his sister with a tiny rakhi thread. She smiles. He dramatically reveals a gigantic gift box — she opens it, a smaller box inside; opens that, another smaller box; finally opens the tiniest box: a single chocolate piece. She laughs; he nods like a genius.",
         kling_prompt="Warm stop-motion scene, two plastic minifigures surrounded by nesting gift boxes open on the floor, staring at a tiny single piece of chocolate, bright cozy room lighting, heartwarming atmosphere, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="02s dramatic box opening · 04s escalating pops · 07s tiny squeak box open · 09s satisfied chime"),
    dict(id=12, occasion="Mother's Day", category="Personal Milestones & Family", source_tag="D2", raw_duration_s=5,
         caption="HAPPY MOTHER'S DAY ❤️ For the one who holds it all together.",
         scene="BOI waddles forward under an absurdly giant brick bouquet five times his size. He reaches Mother mascot, and the entire floral mountain collapses over both of them. A tiny hand emerges from underneath giving a thumbs-up.",
         kling_prompt="Adorable stop-motion macro, tiny plastic arm sticking out from beneath a giant pile of collapsed colorful LEGO flowers giving a thumbs up, bright warm pastel background, heartwarming comedic mood, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="02s heavy struggling footsteps · 03s soft floral crash sound · 04s warm sparkle chime"),
    dict(id=13, occasion="Father's Day", category="Personal Milestones & Family", source_tag="D2", raw_duration_s=10,
         caption="HAPPY FATHER'S DAY! Dad deserves the upgrade.",
         scene="BOI unveils an over-engineered LEGO throne for Dad (cup holders, TV, reading light). Dad sits; the chair reclines smoothly into max comfort. Dad gives a thumbs-up, then quietly presses a hidden button — a snack tray pops out. BOI looks at camera in utter awe.",
         kling_prompt="Comedic stop-motion, Lego minifigure standing proudly beside a giant luxury reclining armchair built of colorful blocks, dad character lounging inside with a snack tray, bright studio lighting, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="02s grand curtain reveal · 04s hydraulic recline hiss · 07s mechanical pop-out · 09s victory fanfare"),
    dict(id=14, occasion="Friendship Day", category="Personal Milestones & Family", source_tag="D2", raw_duration_s=10,
         caption="HAPPY FRIENDSHIP DAY! Better when we fall apart together.",
         scene="Two minifigures march toward each other in dramatic slow motion for an epic high-five. CLACK! Both yellow plastic hands pop clean off. They stare at their detached wrists, look at each other, and bump shoulders instead.",
         kling_prompt="Upbeat stop-motion scene, two plastic minifigures looking at their detached plastic hands on the floor and bumping shoulders in a hug, star confetti in air, vibrant backdrop, macro focus, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="03s slow cinematic footsteps · 06s plastic snapping clack · 08s toy pieces dropping · 09s warm chime"),
    dict(id=15, occasion="Valentine's Day", category="Personal Milestones & Family", source_tag="D2", raw_duration_s=10,
         caption="HAPPY VALENTINE'S DAY ❤️ You make my heart vibrate.",
         scene="BOI builds a glowing red heart brick by brick. He places the final central piece, and the entire heart pulses so hard it gently vibrates him across the table.",
         kling_prompt="Charming macro stop-motion, Lego minifigure standing next to a pulsing red light brick heart sculpture on a wooden table, dreamy bokeh, warm romantic lighting, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="04s plastic brick click · 07s bass heart thumping pulse · 09s cute slide rattle"),
    dict(id=16, occasion="Birthday", category="Personal Milestones & Family", source_tag="D2", raw_duration_s=10,
         caption="HAPPY BIRTHDAY! \U0001F389 We may have found the button.",
         scene='Dark room. BOI hides behind a banner. A door opens. He leaps out shouting "SURPRISE!" and fires a confetti cannon — it gets stuck ON. More confetti. Cut to 8s: only BOI\'s head is visible above a room-high mountain of confetti. Tiny wave.',
         kling_prompt="Festive stop-motion macro, plastic minifigure head peeking out from the very top of a massive pile of colorful confetti that fills the room, holding a party popper, energetic dynamic lighting, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="02s stealthy footsteps · 04s cannon BANG · 06s continuous party horn hiss · 09s squeaky tiny wave"),
    dict(id=17, occasion="Anniversary", category="Personal Milestones & Family", source_tag="D2", raw_duration_s=10,
         caption="HAPPY ANNIVERSARY ❤️ Years later. Still building. Still arguing about the instructions.",
         scene="Two mascots happily build a LEGO set together. One places a brick; the other immediately moves it. A tiny building disagreement escalates into frantic brick placement — then they stop, look at the finished model, smile, and high-five.",
         kling_prompt="Charming macro stop-motion, two toy minifigures standing together proudly in front of a detailed LEGO monument they built, holding hands on a wooden desk, warm cozy romantic lighting, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="02s gentle plastic clicks · 05s rapid-fire intense brick snapping · 07s sudden silence / chime · 09s high-five snap"),
    dict(id=18, occasion="Thank You", category="Everyday BOI", source_tag="D2", raw_duration_s=5,
         caption="THANK YOU ❤️ Subtlety is overrated.",
         scene="BOI holds up a small sign, decides it's too subtle, flips a giant industrial lever. A giant neon wall behind him lights up. He adjusts his stance proudly.",
         kling_prompt="Clean stop-motion shot, plastic minifigure standing in front of a giant glowing neon sign wall illuminating the scene, bright studio setup, warm inviting key lighting, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="01s tiny sign rattle · 03s heavy industrial switch clunk · 04s stadium light buzz & chime"),
    dict(id=19, occasion="Congratulations", category="Everyday BOI", source_tag="D2", raw_duration_s=10,
         caption="CONGRATULATIONS! \U0001F3C6 Obviously, this required a ceremony.",
         scene='BOI stands on a 1st place podium surrounded by fireworks and massive trophies, confused why. He looks down at his neck, sees a tiny "Participant" ribbon, smiles proudly, and raises it to the roaring crowd like Olympic gold.',
         kling_prompt="Dynamic stop-motion, minifigure character on a tall podium holding up a tiny medal with a massive gold trophy beside him, golden glitter showering down, bright victory studio lighting, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="02s fireworks blast · 05s crowd cheering roar · 08s ribbon ping sound · 09s triumphant fanfare"),
    dict(id=20, occasion="Good Luck", category="Everyday BOI", source_tag="D1", raw_duration_s=5,
         caption="Reading the instructions upside down. Confidence: right side up. Good Luck!",
         scene="A minifigure studies an instruction manual held upside down, then closes it, firm confident nod, thumbs up.",
         kling_prompt="Static camera, medium shot. A minifigure studies an instruction manual held upside down, then closes it, firm confident nod, thumbs up. Toy stop-motion aesthetic, bright lighting, solid color background, smooth motion, no on-screen text.",
         post_production_notes=None, alignment_note=None, sfx="Page flip"),
    dict(id=21, occasion="Happy Weekend", category="Everyday BOI", source_tag="D1", raw_duration_s=5,
         caption="Chair reclined. Sunglasses oversized. Ambition also reclined. Happy Weekend!",
         scene="A minifigure reclines in a lounge chair with oversized sunglasses, gives a slow lazy thumbs up without opening its eyes.",
         kling_prompt="Static camera, medium-wide shot. A minifigure reclines in a lounge chair with oversized sunglasses, gives a slow lazy thumbs up without opening its eyes. Toy stop-motion aesthetic, bright relaxed lighting, solid color background, minimal smooth motion, no on-screen text.",
         post_production_notes=None, alignment_note=None, sfx="Relaxed sigh + chair creak"),
    dict(id=22, occasion="You Are The Best", category="Everyday BOI", source_tag="D1", raw_duration_s=5,
         caption="Built an entire trophy just to hand it to you. You Are The Best.",
         scene="A minifigure holds a gold trophy piece, buffs it once, admires it, then holds it out directly toward camera.",
         kling_prompt="Static camera, medium shot. A minifigure holds a gold trophy piece, buffs it once, admires it, then holds it out directly toward camera. Toy stop-motion aesthetic, warm glowing lighting, solid color background, smooth motion, no on-screen text.",
         post_production_notes=None, alignment_note=None, sfx="Trophy shine chime"),
    dict(id=23, occasion="Love You", category="Everyday BOI", source_tag="D2", raw_duration_s=5,
         caption="LOVE YOU ❤️",
         scene="BOI holds a single red LEGO heart brick and presents it to the camera. The heart glows with warmth, pulsing soft light across his face. A sweet, simple smile.",
         kling_prompt="Charming stop-motion macro, toy minifigure holding out a small glowing red heart brick, soft romantic pink and warm ambient lighting, beautiful shallow depth of field, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="02s soft plastic touch · 03s deep warm heart thud · 04s gentle magical chime"),
    dict(id=24, occasion="New Year", category="Seasonal & Daily Expressions", source_tag="D2", raw_duration_s=10,
         caption="HAPPY NEW YEAR! \U0001F386 Right on schedule.",
         scene="BOI stands on a rooftop countdown clock. 3... 2... 1... He pulls the giant lever. Nothing. Pulls again, frantic. Still nothing. Terrified look. Suddenly — BOOM! The sky erupts in fireworks. He instantly assumes a smooth pose, pointing up as if he timed it.",
         kling_prompt="Festive stop-motion night scene, plastic minifigure on a rooftop with hands on hips, colorful fireworks exploding in dark sky background, cinematic lens flare, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="03s countdown ticks · 05s lever squeak failure · 07s massive fireworks explosion · 09s midnight celebration cheer"),
    dict(id=25, occasion="Halloween", category="Seasonal & Daily Expressions", source_tag="D2", raw_duration_s=10,
         caption="HAPPY HALLOWEEN! \U0001F383 Spooky, dangerous, and easily tripped.",
         scene='BOI, dressed as a ghost in a white sheet, jumps out from behind a carved pumpkin shouting "BOO!" Trips on the sheet edge, falls gently into a pile of candy.',
         kling_prompt="Spooky-cute stop-motion, minifigure in a sheet ghost costume lying in a pile of colorful Halloween candy, pumpkin lantern glowing, moody purple lighting, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="03s cute high-pitched \"Boo!\" · 06s candy rattle thud"),
    dict(id=26, occasion="Good Morning", category="Seasonal & Daily Expressions", source_tag="D2", raw_duration_s=5,
         caption="GOOD MORNING ☀️ Technically.",
         scene="A golden sunrise, birds chirping. BOI emerges from bed, hair wildly messy. Stretches dramatically, looks at the sun, smiles... immediately falls backward flat into bed. One hand creeps out from under the blanket for a thumbs-up.",
         kling_prompt="Bright morning stop-motion scene, plastic minifigure bed with an arm sticking out giving a thumbs-up from under a blanket, messy hair piece on pillow, warm golden sunrise light, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="02s morning bird chirps · 03s big yawn · 04s bed mattress thud · 05s cute squeak"),
    dict(id=27, occasion="Good Night & Sweet Dreams", category="Seasonal & Daily Expressions", source_tag="D2", raw_duration_s=5,
         caption="GOOD NIGHT & SWEET DREAMS! Rest well.",
         scene="BOI climbs into a cozy bed, adjusts his sleep mask, turns off the lamp. Total dark peaceful bliss. A rogue 2x2 LEGO brick falls from the ceiling, taps him softly on the head. CLICK. He sighs peacefully and sleeps anyway.",
         kling_prompt="Cozy night stop-motion shot, minifigure tucked under a brick patterned blanket in a small bed with a sleep mask, cool blue moonlight filtering through window, peaceful atmosphere, no on-screen text.",
         post_production_notes=None, alignment_note=None,
         sfx="02s lamp switch click · 04s small plastic 'clack' head impact · 05s soft night lullaby chime"),
]

assert len(CLIPS) == 27, f"expected 27 clips, got {len(CLIPS)}"
assert [c["id"] for c in CLIPS] == list(range(1, 28)), "clip ids must be 1..27 in order"
assert sum(1 for c in CLIPS if c["raw_duration_s"] == 10) == 19, "expected 19 clips at 10s"
assert sum(1 for c in CLIPS if c["raw_duration_s"] == 5) == 8, "expected 8 clips at 5s"


def build_clip_entry(c: dict) -> dict:
    slug = f"{c['id']:02d}-{slugify(c['occasion'])}"
    # Loop-trim placeholder: 5s clips are already within the 4-6s target
    # loop window and use their full raw length; 10s clips default to the
    # first 5s. Both are PLACEHOLDERS -- real Kling footage must be
    # reviewed to find the actual seamless loop point (matching start/end
    # pose) before these are final. SFX cue timestamps below are on the
    # RAW clip's timeline (as authored in the FINAL doc); postprocess.py
    # remaps them relative to loop_trim.in_s and drops any cue that falls
    # outside [in_s, out_s).
    out_s = float(min(c["raw_duration_s"], 5))
    return {
        "id": c["id"],
        "slug": slug,
        "occasion": c["occasion"],
        "category": c["category"],
        "source_tag": c["source_tag"],
        "raw_duration_s": c["raw_duration_s"],
        "caption": c["caption"],
        "scene": c["scene"],
        "kling_prompt": c["kling_prompt"],
        "post_production_notes": c["post_production_notes"],
        "alignment_note": c["alignment_note"],
        "sfx_cues": sfx(c["sfx"]),
        "loop_trim": {"in_s": 0.0, "out_s": out_s, "status": "placeholder"},
        "assets": {
            "raw_input": f"assets/shareables/raw/{slug}.mp4",
            "sfx_dir": f"assets/shareables/sfx/{slug}/",
            "public_output": f"public/shareables/{slug}.mp4",
        },
    }


def main() -> None:
    manifest = {
        "generated_from": SOURCE_DOC,
        "generated_note": (
            "Hand-transcribed 2026-08-08 via this generator for accuracy "
            "(not auto-parsed from markdown). Creative content (scene, "
            "caption, sfx_cues, kling_prompt, post_production_notes, "
            "alignment_note) is LOCKED per Phase 1 -- do not edit "
            "manifest.json directly; edit build_manifest.py (or, for "
            "creative changes, the FINAL doc first) and regenerate. "
            "loop_trim and assets paths are technical placeholders for "
            "Phases 5/7, not creative content."
        ),
        "global": {
            "output_spec": {
                "format": "mp4",
                "codec": "h264",
                "width": 1080,
                "height": 1920,
                "loop_duration_s_min": 4,
                "loop_duration_s_max": 6,
                "max_size_mb": 5,
                "fps": 30,
            },
            "caption": {
                "position": "bottom_third",
                "style": "white_fill_dark_outline",
            },
            "watermark": {
                "position": "bottom_right",
                "opacity": 0.12,
                "opacity_range_note": "10-15% per spec; 12% used as default",
            },
        },
        "clips": [build_clip_entry(c) for c in CLIPS],
    }

    OUTPUT_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} ({len(manifest['clips'])} clips)")


if __name__ == "__main__":
    main()
