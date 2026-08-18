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
}
