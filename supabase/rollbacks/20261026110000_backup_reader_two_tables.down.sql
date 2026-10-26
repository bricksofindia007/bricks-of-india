-- Rollback for 20261026110000_backup_reader_two_tables. Run by hand, in one transaction.
-- Removes the read policy this migration added, then the two grants. The earlier backup login rules are not touched.
DROP POLICY IF EXISTS "backup_reader read" ON public.ai_model_usage;
DROP POLICY IF EXISTS "backup_reader read" ON public.usd_inr_rate;
REVOKE SELECT ON public.ai_model_usage, public.usd_inr_rate FROM backup_reader;
