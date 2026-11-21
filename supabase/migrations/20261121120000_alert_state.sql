-- Order 1941 item 4: last-sent alert band, so a health alert emails only when its band changes.
-- One row per alert key (today: 'egress'). Read and written by scripts/health-check.mjs with the service role.
-- RLS on, and no policies: anon and authenticated get no access at all.

CREATE TABLE IF NOT EXISTS public.alert_state (
  key        text PRIMARY KEY,
  band       text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.alert_state FROM anon, authenticated;
GRANT ALL ON TABLE public.alert_state TO service_role;
