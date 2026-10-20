-- boi:issue 706
-- boi:backup-tables public.sets
-- boi:expect-before select count(*) from public.sets where set_number = '854338' and (theme is null or theme in ('', 'Unknown')) = 1
-- boi:expect-after select count(*) from public.sets where set_number = '854338' and theme = 'Gear' = 1
-- Sets the theme of set 854338 (Lloyd's Sword with Sheath) to Gear, from the public catalogue listing (Brickset). Only this row, only while the theme is still blank or Unknown, so a re-run changes nothing. Set 854335 is NOT changed here (issue 706: its number needs an owner decision).
update public.sets
set theme = 'Gear'
where set_number = '854338'
  and (theme is null or theme in ('', 'Unknown'))
  and (select count(*) from public.sets where set_number = '854338') = 1;
