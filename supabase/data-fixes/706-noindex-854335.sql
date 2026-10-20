-- boi:issue 706
-- boi:backup-tables public.sets
-- boi:expect-before select count(*) from public.sets where set_number = '854335' and noindex_override = false = 1
-- boi:expect-after select count(*) from public.sets where set_number = '854335' and noindex_override = true = 1
-- Sets noindex_override on set 854335 (a second row named "Mateo's Z-Blob Sword", 2026, blank theme; the 2025 set is 854307). The theme is NOT guessed. Only this row, only while it is not already overridden, and only if it is the sole row with this number.
update public.sets
set noindex_override = true
where set_number = '854335'
  and noindex_override = false
  and (select count(*) from public.sets where set_number = '854335') = 1;
