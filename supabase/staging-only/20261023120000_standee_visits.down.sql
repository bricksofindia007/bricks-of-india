-- Rollback for 20261023120000_standee_visits (staging only). Run by hand, in one transaction, only when approved.
drop function if exists public.record_standee_visit(text);
drop table if exists public.standee_visits;
