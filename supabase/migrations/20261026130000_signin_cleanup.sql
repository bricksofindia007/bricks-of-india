-- boi:issue 817
-- Sign-in cleanup (held, flag not needed: it only removes rows that nothing reads). Removes: codes that expired more than
-- 24 hours ago; sends whose day is before today (UTC); sessions that ended more than 30 days ago. Dry run counts only.
-- Service role only (G8). Called by scripts/retention-cleanup.mjs, which skips it while this function is absent.
-- NOT APPLIED: staging rehearsal first; production only in the bundle window.
-- Rollback: supabase/rollbacks/20261026130000_signin_cleanup.down.sql

create or replace function public.cleanup_sign_in_rows(p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  today    text := to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');
  n_codes  bigint := 0;
  n_sends  bigint := 0;
  n_sess   bigint := 0;
begin
  if p_dry_run then
    select count(*) into n_codes from public.sign_in_codes
      where expires_at < now() - interval '24 hours';
    select count(*) into n_sends from public.sign_in_sends
      where day_key < today;
    select count(*) into n_sess from public.account_sessions
      where (revoked_at is not null and revoked_at < now() - interval '30 days')
         or (revoked_at is null and expires_at < now() - interval '30 days');
  else
    delete from public.sign_in_codes where expires_at < now() - interval '24 hours';
    get diagnostics n_codes = row_count;
    delete from public.sign_in_sends where day_key < today;
    get diagnostics n_sends = row_count;
    delete from public.account_sessions
      where (revoked_at is not null and revoked_at < now() - interval '30 days')
         or (revoked_at is null and expires_at < now() - interval '30 days');
    get diagnostics n_sess = row_count;
  end if;
  return jsonb_build_object('dry_run', p_dry_run, 'codes', n_codes, 'sends', n_sends, 'sessions', n_sess);
end
$$;

revoke all on function public.cleanup_sign_in_rows(boolean) from public, anon, authenticated;
grant execute on function public.cleanup_sign_in_rows(boolean) to service_role;
