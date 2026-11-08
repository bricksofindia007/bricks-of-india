-- boi:issue 835
-- boi:backup-tables public.quiet_panic_posts
-- boi:expect-before select count(*) from public.quiet_panic_posts where id = '660c4b8f-9278-404e-9343-da305ec01769' and status = 'pending_approval' and reworked = false and rejection_reason is null = 1
-- boi:expect-after select count(*) from public.quiet_panic_posts where id = '660c4b8f-9278-404e-9343-da305ec01769' and rejection_reason = 'Rework the verdict line only. Change the last line from "Verdict: buy it. Snow." to "Verdict: buy it. Naked trees look sad." Keep every other line, the price and the set facts unchanged.' = 1
-- Sets the rejection reason for the rework of video 45 (Snowman Ornaments). Touches only that row, and only while the reason is still empty, so a re-run changes nothing.
update public.quiet_panic_posts
set rejection_reason = 'Rework the verdict line only. Change the last line from "Verdict: buy it. Snow." to "Verdict: buy it. Naked trees look sad." Keep every other line, the price and the set facts unchanged.'
where id = '660c4b8f-9278-404e-9343-da305ec01769'
  and rejection_reason is null;
