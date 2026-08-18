# BOI_Codex_v2_qp_condensed.md

Condensed, VOICE-ONLY extract of BOI_Codex_v2.md, built 2026-08-19 for VID-QP's
system_prompt (quiet_panic_script_gen.py's _load_codex()) specifically.

WHY THIS EXISTS: the full codex (6,133 words / ~9,573 est. tokens) was being
read verbatim into every single VID-QP script-gen call (both Gemini and
Cerebras) -- confirmed as the dominant driver of Cerebras token cost (full
system prompt ~12,351 est. tokens for a ~300-token output script; see
2026-08-18 audit). Most of the full codex is ARTICLE-format mechanics that
don't apply to a short voice-off video script: India Paragraph structure
(Page 12), News/Review/Opinion word-count tiers (Page 14), article
structural slots (Page 15), affiliate code discipline (Page 18),
article-specific lint gates like image-URL-200 checks (Page 20), and the
codex's own versioning/change-process meta-documentation (Page 21) -- none
of which VID-QP's own gates (duration, price_token, verdict, verdict_reason,
sfx_tags, banned_constructions, vocab_complexity) check for or need.

WHAT'S KEPT: every page that is pure voice/tone/persona grounding, plus the
one video-specific subsection of the otherwise-article-format Page 6.
Verified 2026-08-19 against 3 real published quiet_panic_posts scripts
(Jack-o'-Lantern Pickup Truck, Aston Martin AMR25, Ariel's Royal Wedding
Boat) -- every technique visible in those actual outputs (Swiggy/flight
price comparisons, "Verdict: buy it", self-deprecating build humor) maps
directly to a KEPT page below; nothing from a CUT page appears in them.

SOURCE PAGES KEPT (verbatim, from BOI_Codex_v2.md): 1 (Core Persona), 2
(Voice DNA), 3 (Humour Engine), 4 (Genius Loop), 5 (Language System), 6's
"Video Scripting Template"/"Shot List" subsection only, 7 (Indian Context
Layer), 8 (Rhythm & Delivery), 9 (Rules & Restrictions), 10 (Signature
Lines & Hooks), 11 (True Voice Engine), 13 (Verdict System), 17 (Banned
Constructions and Anti-Patterns), 19 (Worked Examples).

SOURCE PAGES CUT: 6's non-video formats (Build Review/Review-Judgment/
Experiment -- article formats), 12 (India Paragraph), 14 (Length/Format
Spec for article tiers), 15 (Structural Slots), 16 (Subscribe PSA -- not
checked by any VID-QP gate, and not the source of the "Subscribe" framing
used in VID-QP's own PERSONA_RULES/reference scripts), 18 (Affiliate
Discipline), 20 (article Lint Gates), 21 (Versioning/Change Process meta).

See BOI_Codex_v2_qp_condensed.PROVENANCE.md for full rationale.
