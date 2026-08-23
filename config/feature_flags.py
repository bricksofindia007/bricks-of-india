"""
Feature flags for staged/experimental code that has been merged to main but
is not yet meant to be active. A plain dict, checked explicitly at the call
site -- not a comment, not a commit-message date, not a docstring promise.

Why this exists: commit 7fc986d ("Staged: ... VID-QP fixes (hold for
08-22) (#40)", merged 2026-08-16) added a shadow-mode diagnostic to
generate_quiet_panic_video.py's run_all_gates() gated only by a comment
("SHADOW MODE (2026-08-16)... hold for 08-22"). Comments are not enforced
by CI and go live on merge regardless of wording -- the very next scheduled
run (Monday 2026-08-17) crashed on it. See CLAUDE.md's "Staged/experimental
code" rule.

Usage:
    from config.feature_flags import FEATURE_FLAGS
    if FEATURE_FLAGS.get("some_flag", False):
        ...

Flags default False. Flipping one to True is a deliberate, reviewable,
one-line diff -- not a side effect of an unrelated merge.
"""

FEATURE_FLAGS = {
    # VID-QP pre-TTS caption-length shadow-mode estimate (added 2026-08-16,
    # crashed 2026-08-17, shape bug fixed 2026-08-18 in
    # scripts/video/generate_quiet_panic_video.py's run_all_gates()).
    # Currently unused by that fix -- the shadow check itself always runs
    # and is always non-blocking by construction (see run_all_gates()'s
    # '_pre_tts_estimate' entry, which hardcodes 'pass': True regardless of
    # this flag). This flag is reserved for a future decision on whether to
    # promote the shadow check into a REAL blocking gate. Leave False until
    # that product decision is made explicitly.
    "qp_shadow_mode_estimate": False,

    # Cerebras fallback (VID-P4 engine.py, VID-QP quiet_panic_script_gen.py).
    # Added 2026-08-19: Cerebras has been payment-blocked (402 "Payment
    # required") since at least 2026-08-18 and Abhinav cannot add a payment
    # method to that account (see CLAUDE.md). Fallback order is now
    # Gemini -> Groq (free tier, 429 on limit rather than a permanent 402).
    # The Cerebras integration code is kept intact, not deleted, behind this
    # flag -- so it can be re-enabled with a one-line diff if billing is
    # ever resolved, without a rewrite. Leave False until Abhinav confirms
    # Cerebras billing is fixed.
    "cerebras_fallback_enabled": False,

    # VID-QP Groq fallback (quiet_panic_script_gen.py's _call_groq() --
    # VID-P4's own engine.py Groq fallback has its own separate flag pair
    # below, p4_groq_fallback_enabled/p4_groq_fallback_model, added in the
    # FINAL ARCHITECTURE PASS). Added 2026-08-22 (qwen rollout evidence
    # pass): Groq previously fired unconditionally the moment Gemini
    # failed, targeting the now-decommissioned llama-3.3-70b-versatile
    # (confirmed dead, live 404) -- effectively a silent no-op. Swapping to
    # a model that actually works (qwen/qwen3.6-27b, see the flag below)
    # behind the SAME unconditional call would put live qwen output into
    # production with zero review the moment this merges. This flag stops
    # that: Groq fallback is now skipped entirely (falls through to the
    # Cerebras check, or raises) until Abhinav explicitly enables it after
    # reviewing the rollout's evidence (5-set P4 comparison + QP voice
    # test).
    #
    # Flipped True 2026-08-22 (FINAL ARCHITECTURE PASS) per explicit
    # instruction, evidence reviewed. IMPORTANT CAVEAT, confirmed live via
    # `gh secret list`: GROQ_API_KEY is NOT currently a GitHub repo secret
    # -- it only exists in this developer's local scripts/test/.env
    # (explicitly marked "local/test credential only" when first provided).
    # Flipping this flag is therefore currently a functional no-op in
    # production: _call_groq() will hit `if not GROQ_API_KEY: raise
    # RuntimeError`, fail cleanly, and fall through to Cerebras/raise, same
    # as if this flag were still False. Real Groq calls will not happen in
    # any scheduled workflow until Abhinav adds GROQ_API_KEY as an actual
    # repo secret -- that step was deliberately NOT taken here, per the
    # earlier explicit instruction not to add it without a dedicated
    # decision. scripts/canary/model_canary.py's daily run will report this
    # exact condition ("SECRET NOT CONFIGURED") until it's resolved.
    "qp_groq_fallback_enabled": True,

    # Which model quiet_panic_script_gen.py's _call_groq() targets, once
    # qp_groq_fallback_enabled above is True. qwen/qwen3.6-27b chosen over
    # the dead llama-3.3-70b-versatile after real Groq-side testing (fits
    # the trimmed codex's TPM budget, reasoning_effort='none' required --
    # see _call_groq()'s docstring). Kept as its own flag value (not
    # hardcoded in _call_groq()) so a future model swap or rollback is a
    # one-line config change, not a code change.
    "qp_groq_fallback_model": "qwen/qwen3.6-27b",

    # VID-P4 Groq fallback (engine.py's _try_groq()). Added 2026-08-22 as
    # part of the FINAL ARCHITECTURE PASS -- same reasoning as
    # qp_groq_fallback_enabled/qp_groq_fallback_model above, brought to
    # parity: _try_groq() previously fired unconditionally on Gemini
    # failure, targeting the dead llama-3.3-70b-versatile. Separate from
    # QP's flags because Phase A's evidence showed materially worse qwen
    # results against VID-P4's prompt (word-count overruns on 4/5 test
    # sets, bad price math on 2/5) -- P4 and QP must be independently
    # enable-able, not coupled to the same switch, so a decision on one
    # pipeline never silently drags the other along.
    #
    # Stays False (Phase 2 re-test, FINAL ARCHITECTURE PASS): re-ran the
    # same 5 real P4 candidates through the REAL self-correcting retry loop
    # this time (_word_count_retry_note()/GENERIC_RETRY_NOTE, 3 attempts
    # each, capped below production's MAX_GENERATION_ATTEMPTS=6 for test
    # cost) -- 0 of 5 converged to a full gate pass. Word counts trended
    # down with feedback (e.g. 198->136->136) but never landed inside
    # 90-110 within 3 attempts, and new failure modes appeared on later
    # attempts (a hallucinated, nonexistent set number "1919" on one
    # candidate's first draw). Per the explicit instruction governing this
    # decision: enable only if the re-test showed real improvement: it did
    # not. Leave False until P4-specific prompt/model iteration produces
    # real evidence of convergence.
    "p4_groq_fallback_enabled": False,
    "p4_groq_fallback_model": "qwen/qwen3.6-27b",
}
