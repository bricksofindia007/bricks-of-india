-- Security hardening (issue #188, 2026-09-25). No reader impact: RLS still
-- governs SELECT/INSERT/UPDATE/DELETE, which are deliberately left untouched
-- on existing tables -- the site depends on them.
--
-- 1. community_spotlights had two permissive SELECT policies. Postgres ORs
--    permissive policies, so "Public read community_spotlights" (anon,
--    USING (true)) cancelled "public can read published spotlights"
--    (USING (published = true)) -- an anonymous visitor could read
--    unpublished drafts. Table was empty when found; the published-only
--    policy stays.
DROP POLICY IF EXISTS "Public read community_spotlights" ON public.community_spotlights;

-- 2. TRUNCATE is not subject to RLS; REFERENCES and TRIGGER are never used
--    by the Data API. Remove all three from the API roles on every existing
--    table.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 3. Default privileges: every table, sequence and function `postgres`
--    creates in public (postgres owns all public tables and runs every
--    migration here) was automatically granted ALL to anon/authenticated.
--    From now on new objects get nothing by default -- each migration grants
--    exactly what it needs, which lint-migration-grants.yml (#182/#189)
--    already enforces for tables. supabase_admin's own default ACLs are
--    platform-managed and not alterable by postgres; left as-is.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
