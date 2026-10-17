-- Rollback for 20261017210000_revoke_sequence_write_grants. Run by hand, in one transaction, only when approved.
-- Restores the update right on sequences that the migration removed. Reopens sequence writes: use only if a
-- specific job needs it, and record why.
begin;
grant update on all sequences in schema public to anon, authenticated;
commit;
