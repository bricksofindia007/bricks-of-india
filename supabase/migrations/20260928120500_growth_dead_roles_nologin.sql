-- boi:issue 416
-- P8 item 1 (28 Sep 2026): growth_dashboard and growth_webhook are used only by the growth dashboard
-- app, whose host is dead (dashboard/src/lib/db.ts, dashboard/src/lib/webhook-db.ts). The live Resend
-- webhook runs on the main site with the service role (src/app/api/growth/resend-webhook). Their
-- passwords were exposed in a session on 28 Sep (G17), so they are disabled instead of rotated:
-- NOLOGIN makes the exposed passwords useless. Grants and ownership are untouched.
-- Rollback: ALTER ROLE growth_dashboard LOGIN; ALTER ROLE growth_webhook LOGIN; (then set new passwords)
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['growth_dashboard', 'growth_webhook'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('ALTER ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('growth_dashboard', 'growth_webhook') AND rolcanlogin) THEN
    RAISE EXCEPTION 'growth_dashboard / growth_webhook still have LOGIN -- rolling back';
  END IF;
END $$;
