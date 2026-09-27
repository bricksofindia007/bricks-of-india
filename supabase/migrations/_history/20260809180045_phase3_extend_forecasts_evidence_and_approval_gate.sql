-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260809180045, name phase3_extend_forecasts_evidence_and_approval_gate, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Phase 3: growth.forecasts already existed (Phase 0) with track_type,
-- platform, metric, current_value, target_value, projected_date,
-- confidence, evidence_weeks, computed_at -- clearly designed with this
-- phase in mind, so extended rather than duplicated into a new table.
--
-- Two real gaps required new columns:
--   1. No status/approval-gate column existed at all -- meaning nothing
--      written here previously had any pending_approval concept, which
--      the "no direct actions" principle requires.
--   2. The evidence bar is defined in days (14 consecutive), not weeks --
--      evidence_weeks is left in place but deprecated/unpopulated going
--      forward rather than dropped (non-destructive).
--
-- append-only: no unique constraint added. computed_at already existed,
-- implying the original Phase 0 design intent was a timestamped log of
-- forecast snapshots over time, not a single mutable per-metric row --
-- weekly runs INSERT a new row rather than upserting over history.

alter table growth.forecasts
  add column status text not null default 'pending_approval'
    check (status in ('pending_approval', 'reviewed', 'dismissed')),
  add column evidence_days integer,
  add column evidence_met boolean not null default false,
  add column computed_rate numeric,
  add column ai_narrative text;

comment on column growth.forecasts.evidence_weeks is
  'Deprecated as of Phase 3 -- superseded by evidence_days (the evidence bar is defined in days). Left nullable/unused for backward compatibility, not populated going forward.';
comment on column growth.forecasts.evidence_days is
  'Phase 3: count of consecutive real (phase2_nightly/phase2_backfill) days of data as of computed_at, per the evidence-bar definition in docs/architecture.md.';
comment on column growth.forecasts.evidence_met is
  'Phase 3: true only when evidence_days >= the evidence bar. projected_date/computed_rate are null whenever this is false.';
comment on column growth.forecasts.computed_rate is
  'Phase 3: pure-arithmetic rate of change per day over the evidence window (fact, never LLM-derived). Null when evidence not met.';
comment on column growth.forecasts.ai_narrative is
  'Phase 3: LLM-generated interpretive commentary, kept structurally separate from computed_rate/current_value/target_value/projected_date (fact fields). Never merged with them.';
comment on column growth.forecasts.status is
  'Phase 3: pending_approval by default. No code path in this system transitions it out of pending_approval -- that requires a human review surface, explicitly out of scope for Phase 3.';
