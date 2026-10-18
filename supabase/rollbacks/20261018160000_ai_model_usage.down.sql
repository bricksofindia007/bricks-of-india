-- Rollback for 20261018160000_ai_model_usage. Run by hand, in one transaction, only when approved.
-- Drops the per-model counts: the rupee stop stops counting until the table is back.
begin;
DROP FUNCTION IF EXISTS public.ai_model_usage_add(date, text, text, bigint, bigint, numeric);
DROP TABLE IF EXISTS public.ai_model_usage;
commit;
