-- Awaiting approval. Rollback for 568-store-policy-hashes.sql. Not run. Keep the RAISE below until the fix has run and the rollback is approved.
-- Post-fix md5 guards (MD5_AFTER_TBD) are not filled yet. Fill them from the staging run before this file is used.
-- Restores the two keys on public.stores.scraper_config to the values seeded by migration 20260927164937 (fp55).
-- Only applies where the row still holds the post-fix values (guard), so a later change is never overwritten.
-- Note: the toycra values restored here are the 1 Oct 2026 hashes that the baseline notes say were never approved.
-- boi:issue 568
-- boi:backup-tables public.stores
-- boi:expect-before select count(*) from public.stores where (id, scraper_config->>'robots_sha256', scraper_config->>'agents_sha256') in (values ('mybrickhouse','0be736de585b832b6e0d12b007977767427b69fba281e56c71adee06ed1657c8','d6ebec3fd0e933c93ae66c57de0470290e7630cd08a1bffabfcd28d831286a0d'), ('toycra','e9d72a1bba1cbf32f826a5955b1912c68bb8952a3fac3760e87a6e282462169e','8d27d7d4011e85f45c74dc7d7652d500e7b39c937995a678e5f91be229957360')) = 2
-- boi:expect-after  select count(*) from public.stores where (id, scraper_config->>'robots_sha256', scraper_config->>'agents_sha256') in (values ('mybrickhouse','a27f6b8a535c9d00c8298de7ec53ed7045c152004dd80b91b7b47eb8a0948f56','ecdf25c613d3ae18e7cde4626e924cc28f306a517dd337736b8091bd02a3c6d8'), ('toycra','920581eb40e1e4671e7410d17a144415817bc695b30fa12b04a56eb164e8aec4','ea70ad00292e27f890db9d37956c6f606e5edd2187d34362e8dbbdb6e50a99b6')) = 2

DO $$ BEGIN RAISE EXCEPTION 'HOLD: rollback not approved. Do not run.'; END $$;

update public.stores set scraper_config = scraper_config || jsonb_build_object(
  'robots_sha256', 'a27f6b8a535c9d00c8298de7ec53ed7045c152004dd80b91b7b47eb8a0948f56',
  'agents_sha256', 'ecdf25c613d3ae18e7cde4626e924cc28f306a517dd337736b8091bd02a3c6d8')
where id = 'mybrickhouse'
  and scraper_config->>'robots_sha256' = '0be736de585b832b6e0d12b007977767427b69fba281e56c71adee06ed1657c8'
  and scraper_config->>'agents_sha256' = 'd6ebec3fd0e933c93ae66c57de0470290e7630cd08a1bffabfcd28d831286a0d';

update public.stores set scraper_config = scraper_config || jsonb_build_object(
  'robots_sha256', '920581eb40e1e4671e7410d17a144415817bc695b30fa12b04a56eb164e8aec4',
  'agents_sha256', 'ea70ad00292e27f890db9d37956c6f606e5edd2187d34362e8dbbdb6e50a99b6')
where id = 'toycra'
  and scraper_config->>'robots_sha256' = 'e9d72a1bba1cbf32f826a5955b1912c68bb8952a3fac3760e87a6e282462169e'
  and scraper_config->>'agents_sha256' = '8d27d7d4011e85f45c74dc7d7652d500e7b39c937995a678e5f91be229957360';
