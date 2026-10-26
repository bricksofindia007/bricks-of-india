-- Rollback for 20261026120000_table_size_top5.sql (issue 812): removes the reading function.
drop function if exists public.table_size_top5();
