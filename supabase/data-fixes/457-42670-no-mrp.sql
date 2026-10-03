-- boi:issue 457
-- boi:backup-tables public.sets
-- boi:expect-before select count(*) from public.sets where set_number = '42670' and lego_mrp_inr = 15300 and mrp_verified = false = 1
-- boi:expect-after select count(*) from public.sets where set_number = '42670' and lego_mrp_inr is null and mrp_verified = false = 1
-- 42670: its MRP can't be confirmed (no longer on LEGO.in), so no MRP is shown. The unconfirmed catalogue value is cleared.
UPDATE public.sets SET lego_mrp_inr = NULL, mrp_review_reason = 'No MRP shown (3 Oct 2026): not on LEGO.in, cannot be confirmed'
WHERE set_number = '42670' AND lego_mrp_inr = 15300 AND mrp_verified = false;
