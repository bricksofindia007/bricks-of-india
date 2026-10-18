-- boi:issue 663
-- Failed sign-in attempts, counted per client (a salted hash of the IP) and per account. After 10 failures in
-- 10 minutes, a key is blocked for 10 minutes. Keys are hashes: no IP address is stored.
-- Row security is on with no policies; only the server role can read or write. Complements the edge rate rule.
CREATE TABLE IF NOT EXISTS public.login_attempts (
  key           text PRIMARY KEY,
  window_start  timestamptz NOT NULL,
  failures      integer NOT NULL DEFAULT 0,
  blocked_until timestamptz
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.login_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.login_attempts TO service_role;
