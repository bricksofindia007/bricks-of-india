-- Gate Remediation Architecture (2026-08-29). Trigger: story #54 (Shelby
-- Cobra 427 S/C, video_posts id 01154887-ad86-4cf5-bfb1-e0bcf15a7c0d)
-- reached pending_approval with a failing G11 and zero remediation
-- attempt -- the approver had to manually query gate_results to learn a
-- gate had even failed, since nothing surfaced it. gate_results already
-- records every gate's pass/fail + reason, but as raw per-gate data, not a
-- pre-diagnosed summary a reviewer sees first.
--
-- escalation_note is null for a clean story (every gate passed outright,
-- or a failure was fully auto-remediated -- see gates.py's
-- GATE_REMEDIATION_TIER and engine.py's _try_tier1_pre_tts_remediation /
-- render_with_caption_gate). Populated only when a story reaches a human
-- with a gate failure that survived remediation -- see engine.py's
-- build_escalation_note() for the exact shape ({gates: [{gate,
-- what_it_caught, technical_reason}], remediation_attempted,
-- decision_needed}).

ALTER TABLE video_posts
  ADD COLUMN IF NOT EXISTS escalation_note jsonb;

COMMENT ON COLUMN video_posts.escalation_note IS 'Gate Remediation Architecture (2026-08-29): structured, pre-diagnosed note for a reviewer -- null for a clean story (every gate passed, or a failure was fully auto-remediated); populated only when an unresolved gate failure reaches pending_approval after remediation was attempted. Shape: {gates: [{gate, what_it_caught, technical_reason}], remediation_attempted, decision_needed}. See engine.py build_escalation_note().';
