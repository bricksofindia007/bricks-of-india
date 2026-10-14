-- boi:issue 287
-- P8 item 3 (28 Sep 2026): human-approved catalogue name aliases (G4: retailers and names are data, not
-- code). The FP5.4 identity ladder accepts a listing whose text matches a set's catalogue name OR one of
-- its approved aliases here (scripts/lib/identity-ladder.mjs matchesSetName). Rows are added only through
-- approved db-migrate data fixes (supabase/data-fixes/), each recording who approved it and the evidence.
-- Rollback: DROP TABLE public.set_name_aliases;
CREATE TABLE IF NOT EXISTS public.set_name_aliases (
  set_number   text        NOT NULL REFERENCES public.sets(set_number),
  alias_name   text        NOT NULL CHECK (length(btrim(alias_name)) > 0),
  source       text        NOT NULL,          -- where the alias was seen, e.g. 'mybrickhouse listing title'
  evidence     text        NOT NULL,          -- why it's the same set (pieces, theme, ...)
  approved_by  text        NOT NULL,
  approved_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (set_number, alias_name)
);
ALTER TABLE public.set_name_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.set_name_aliases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.set_name_aliases TO service_role;
