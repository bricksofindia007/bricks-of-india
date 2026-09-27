-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260825043702, name catalog_coverage_trend, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

CREATE TABLE IF NOT EXISTS catalog_coverage_trend (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  logged_at          timestamptz DEFAULT now(),
  total_buildable    integer     NOT NULL,
  missing_pieces     integer     NOT NULL,
  missing_pieces_pct numeric     NOT NULL,
  missing_year       integer     NOT NULL,
  missing_year_pct   numeric     NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catalog_coverage_trend_logged_at ON catalog_coverage_trend (logged_at);
ALTER TABLE catalog_coverage_trend ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON catalog_coverage_trend
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
