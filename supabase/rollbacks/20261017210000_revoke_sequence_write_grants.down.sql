-- Rollback for 20261017210000_revoke_sequence_write_grants. Run by hand, in one transaction, only when approved.
-- Restores the update right for anon and authenticated on the eight sequences that had it before the release (8 sequences x 2 roles = 16 grants). Not all sequences.
-- Removes the migration ledger row, so the migration can be applied again.
begin;
grant update on sequence
  public.community_spotlights_id_seq, public.featured_videos_id_seq, public.guides_id_seq,
  public.opinion_cadence_log_id_seq, public.posted_lego_sets_id_seq, public.posted_sets_id_seq,
  public.price_snapshots_id_seq, public.publish_attempts_id_seq
  to anon, authenticated;
delete from supabase_migrations.schema_migrations where version = '20261017210000';
commit;
-- Verify (expected: 16)
-- select count(*) as sequence_update_grants from pg_class c join pg_namespace n on n.oid = c.relnamespace, lateral aclexplode(c.relacl) a join pg_roles r on r.oid = a.grantee where n.nspname = 'public' and c.relkind = 'S' and a.privilege_type = 'UPDATE' and r.rolname in ('anon', 'authenticated');
