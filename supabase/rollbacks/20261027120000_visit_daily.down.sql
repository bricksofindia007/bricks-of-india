-- Rollback for 20261027120000_visit_daily.sql (issue 822). Removes only the visit_daily table and its rows.
drop table if exists public.visit_daily;
