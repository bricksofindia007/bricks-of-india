-- Rollback for 20261017230000_revoke_all_sequence_grants. Run by hand, in one transaction, only when approved.
-- Restores the sequence rights the migration removed (usage and update for the anonymous and signed-in roles).
-- Reopens sequence writes: use only for a named job, and record why.
begin;
grant usage, update on all sequences in schema public to anon, authenticated;
commit;
