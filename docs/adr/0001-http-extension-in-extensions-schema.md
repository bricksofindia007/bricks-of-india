# ADR 0001: The `http` extension lives in `extensions`, not `public`

**Status:** Accepted, 27 Sep 2026 (FP3.0 #361, I18 #360; PR #362; guardrail G15, PR #376)

## Context
`http` 1.6 was created in `public` (20260709112515). Its 19 functions carried EXECUTE for PUBLIC, anon and authenticated, granted by `supabase_admin`. `public` is exposed by the Data API, so anyone with the publishable key could `POST /rest/v1/rpc/http_get` and make the database fetch arbitrary URLs (SSRF). Its only real use ever was two one-off `postgres` statements (9 Jul image repair).

## Why REVOKE didn't work
The grants belong to `supabase_admin`. As `postgres` (not the owner, and with no grant option on the original ACL), `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` completes with `WARNING: no privileges could be revoked` and changes nothing. That was tested in a rolled-back transaction. After relocation, `postgres` has grant option, but `REVOKE … FROM PUBLIC` is still a silent no-op: only the grantor can revoke. `ALTER EXTENSION http SET SCHEMA` is unsupported for this extension.

## Decision
`DROP EXTENSION http; CREATE EXTENSION http WITH SCHEMA extensions;` This is Supabase's documented fix for `extension_in_public`. It was applied repo-file-first in one psql transaction with assertions.

## Why relocation closes it
The grant still exists: `has_function_privilege('anon', …)` is **true**, because the functions keep `=X/supabase_admin`. But anon and authenticated can only run SQL through PostgREST, and PostgREST exposes only `public, graphql_public, growth`. After the move, `rpc/http_get` returns 404 PGRST202, and the `extensions` profile returns 406 PGRST106. `postgres` keeps `http_*` for admin one-offs, since its search_path includes `extensions`.

## The condition that reopens it (G15)
Adding `extensions` to the Data API's exposed schemas would make every function there, including `http_get`, callable by anon again. **G15** (CLAUDE.md) forbids that without a security review and chat sign-off. `ci.yml` enforces it with a live probe on every CI run: an anon request for the `extensions` profile must return 406 PGRST106.

## Consequences
The Security Advisor no longer flags `http`. A support question to Supabase about revoking PUBLIC's EXECUTE is optional and blocks nothing. `pg_trgm` is still in `public` (a separate item).
