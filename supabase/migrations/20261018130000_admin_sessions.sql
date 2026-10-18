-- boi:issue 625
-- Admin sign-in sessions (B6a). A session is a random token given to the browser; only its SHA-256 hash is stored.
-- The browser never holds the password, and the stored hash cannot be used as a session token.
-- Row security is on with no policies. Anonymous and signed-in users get no access at all. Only the server-side
-- role (service_role) can touch the table. Expiry is checked on the server, on every read.
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  token_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked    boolean NOT NULL DEFAULT false
);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admin_sessions TO service_role;
