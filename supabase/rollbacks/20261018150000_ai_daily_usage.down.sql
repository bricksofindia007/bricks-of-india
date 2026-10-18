-- Rollback for 20261018150000_ai_daily_usage. Run by hand, in one transaction, only when approved.
-- Drops the counter: daily caps stop counting until the table is back.
begin;
DROP FUNCTION IF EXISTS public.ai_usage_add(date, text, integer, bigint);
DROP TABLE IF EXISTS public.ai_daily_usage;
commit;
