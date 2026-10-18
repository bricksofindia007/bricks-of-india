-- Shared daily counter for AI calls, per provider. Written only by the server role, through one atomic
-- function, so concurrent calls cannot under-count. Row security is on with no policies, and anon and
-- authenticated have no access.
CREATE TABLE IF NOT EXISTS public.ai_daily_usage (
  day      date NOT NULL,
  provider text NOT NULL,
  calls    integer NOT NULL DEFAULT 0,
  tokens   bigint  NOT NULL DEFAULT 0,
  PRIMARY KEY (day, provider)
);

ALTER TABLE public.ai_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_daily_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_daily_usage TO service_role;

CREATE OR REPLACE FUNCTION public.ai_usage_add(p_day date, p_provider text, p_calls integer, p_tokens bigint)
RETURNS public.ai_daily_usage
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO public.ai_daily_usage AS u (day, provider, calls, tokens)
  VALUES (p_day, p_provider, p_calls, p_tokens)
  ON CONFLICT (day, provider) DO UPDATE SET calls = u.calls + excluded.calls, tokens = u.tokens + excluded.tokens
  RETURNING u.*;
$$;

REVOKE ALL ON FUNCTION public.ai_usage_add(date, text, integer, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_usage_add(date, text, integer, bigint) TO service_role;
