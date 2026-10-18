-- Rollback card 3 of 5: undo migration 20261017210000 (sequence update right).
-- Paste into the Supabase SQL editor of the PRODUCTION project. The whole text is one transaction.
-- Restores the update right for anon and authenticated on the eight sequences that had it before the release
-- (the same eight as scripts/backup/prod-grants-2026-10-18.sql: 8 sequences x 2 roles = 16 grants). Not all sequences.
begin;
grant update on sequence
  public.community_spotlights_id_seq, public.featured_videos_id_seq, public.guides_id_seq,
  public.opinion_cadence_log_id_seq, public.posted_lego_sets_id_seq, public.posted_sets_id_seq,
  public.price_snapshots_id_seq, public.publish_attempts_id_seq
  to anon, authenticated;
delete from supabase_migrations.schema_migrations where version = '20261017210000';
commit;
