-- boi:issue 706
-- boi:backup-tables public.sets
-- boi:expect-before select count(*) from public.sets where set_number = '854338' and (theme is null or theme in ('', 'Unknown')) = 1
-- boi:expect-after select count(*) from public.sets where set_number = '854338' and theme = 'Role Play Toys and Costumes' = 1
-- Sets the theme of set 854338 (Lloyd's Sword with Sheath) to 'Role Play Toys and Costumes' (the catalogue spelling used on production for set 854307). Only this row, only while the theme is still blank or Unknown, so a re-run changes nothing. Set 854335 is NOT changed here (issue 706: its number needs an owner decision).
update public.sets
set theme = 'Role Play Toys and Costumes'
where set_number = '854338'
  and (theme is null or theme in ('', 'Unknown'))
  and (select count(*) from public.sets where set_number = '854338') = 1;
