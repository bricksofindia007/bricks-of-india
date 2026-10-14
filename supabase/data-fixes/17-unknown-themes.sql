-- boi:issue 17
-- boi:backup-tables public.sets
-- boi:expect-before select count(*) from public.sets where theme = 'Unknown' and set_number in ('10243', '10251', '10255', '10264', '11211', '3223', '3677', '40312', '40313', '4888', '4903', '4904', '60050', '60051', '60052', '60098', '60197', '60205', '60238', '60335', '60336', '60337', '60423', '60469', '60509', '60511', '66239', '66374', '66405', '66493', '6680480', '7222', '7270', '7499', '7895', '7896', '7897', '7898', '7936', '7937', '7938', '7939', '7997', '853842', '854065', '8867', 'K7895', 'K7896') = 48
-- boi:expect-after select count(*) from public.sets where theme = 'Unknown' = 0
-- (g) Catalogue Health: 48 sets showed theme "Unknown" on their pages (10243 Parisian Restaurant, the City trains, ...). Cause: scripts/sync-rebrickable.js wrote
-- "Unknown" when a Rebrickable theme lookup failed (rate limit). Correct names from Rebrickable (1 Oct 2026), the same names the rest of the catalogue uses.
UPDATE public.sets SET theme = 'Modular Buildings' WHERE set_number = '10243' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Modular Buildings' WHERE set_number = '10251' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Modular Buildings' WHERE set_number = '10255' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Modular Buildings' WHERE set_number = '10264' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Iron Man and His Awesome Friends' WHERE set_number = '11211' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Designer Sets' WHERE set_number = '3223' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '3677' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Xtra' WHERE set_number = '40312' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Xtra' WHERE set_number = '40313' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Designer Sets' WHERE set_number = '4888' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Designer Sets' WHERE set_number = '4903' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Designer Sets' WHERE set_number = '4904' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60050' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60051' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60052' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60098' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60197' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60205' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60238' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60335' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60336' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60337' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60423' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60469' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60509' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '60511' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '66239' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '66374' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '66405' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '66493' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'One Piece' WHERE set_number = '6680480' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Designer Sets' WHERE set_number = '7222' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Designer Sets' WHERE set_number = '7270' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '7499' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '7895' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '7896' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '7897' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '7898' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '7936' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '7937' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '7938' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '7939' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '7997' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Xtra' WHERE set_number = '853842' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Xtra' WHERE set_number = '854065' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = '8867' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = 'K7895' AND theme = 'Unknown';
UPDATE public.sets SET theme = 'Trains' WHERE set_number = 'K7896' AND theme = 'Unknown';
