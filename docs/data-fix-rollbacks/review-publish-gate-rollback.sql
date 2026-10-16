-- Rollback for migration 20261016120000_review_publish_gate.
-- Kept out of the migrations folder so it is not applied. Run by hand, in one transaction, only when approved.
-- Removes the trigger and its function. No data is changed.
BEGIN;
DROP TRIGGER IF EXISTS review_publish_gate ON public.reviews;
DROP FUNCTION IF EXISTS public.review_publish_gate();
COMMIT;
