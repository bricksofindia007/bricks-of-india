-- Per-model daily AI usage, for the rupee stop: calls, input tokens, output tokens and rupees, per UTC day and
-- model. Written only by the server role, through one atomic function, so concurrent calls cannot under-count.
-- Row security is on with no policies, and anon and authenticated have no access.
-- Supersedes the provider-level counter in 20261018150000 for rupee purposes; that table is left as it is.
CREATE TABLE IF NOT EXISTS public.ai_model_usage (
  day            date NOT NULL,
  provider       text NOT NULL,
  model          text NOT NULL,
  calls          integer NOT NULL DEFAULT 0,
  input_tokens   bigint  NOT NULL DEFAULT 0,
  output_tokens  bigint  NOT NULL DEFAULT 0,
  rupees         numeric(12,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (day, provider, model)
);

ALTER TABLE public.ai_model_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_model_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_model_usage TO service_role;

CREATE OR REPLACE FUNCTION public.ai_model_usage_add(
  p_day date, p_provider text, p_model text, p_input bigint, p_output bigint, p_rupees numeric
)
RETURNS public.ai_model_usage
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO public.ai_model_usage AS u (day, provider, model, calls, input_tokens, output_tokens, rupees)
  VALUES (p_day, p_provider, p_model, 1, p_input, p_output, p_rupees)
  ON CONFLICT (day, provider, model) DO UPDATE SET
    calls         = u.calls + 1,
    input_tokens  = u.input_tokens + excluded.input_tokens,
    output_tokens = u.output_tokens + excluded.output_tokens,
    rupees        = u.rupees + excluded.rupees
  RETURNING u.*;
$$;

REVOKE ALL ON FUNCTION public.ai_model_usage_add(date, text, text, bigint, bigint, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_model_usage_add(date, text, text, bigint, bigint, numeric) TO service_role;
