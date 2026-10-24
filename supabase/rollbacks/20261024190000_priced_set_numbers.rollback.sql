-- Rollback for 20261024190000_priced_set_numbers.sql. Removes the function only.
drop function if exists public.priced_set_numbers();
