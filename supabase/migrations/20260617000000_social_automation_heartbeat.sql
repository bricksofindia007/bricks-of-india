-- social_automation_heartbeat
-- Tracks last success/failure timestamp per social platform.
-- Written by pipeline.py on every run. Read by health-check.mjs Check 6c.
-- Access: service_role only (no anon SELECT) — RLS enabled, no policies.

CREATE TABLE IF NOT EXISTS public.social_automation_heartbeat (
    platform         text        PRIMARY KEY,
    last_success_at  timestamptz,
    last_failure_at  timestamptz,
    last_error       text,
    updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_automation_heartbeat ENABLE ROW LEVEL SECURITY;

-- No RLS policies — service_role bypasses RLS by default; anon has no access.

-- Seed both platforms so health-check can always find a row (last_success_at starts NULL).
INSERT INTO public.social_automation_heartbeat (platform)
VALUES ('instagram'), ('youtube')
ON CONFLICT (platform) DO NOTHING;

-- updated_at trigger — reuses update_updated_at() from 20260503000000_pending_drafts.sql
-- (originally defined in scripts/schema.sql baseline).
CREATE TRIGGER set_social_automation_heartbeat_updated_at
BEFORE UPDATE ON public.social_automation_heartbeat
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
