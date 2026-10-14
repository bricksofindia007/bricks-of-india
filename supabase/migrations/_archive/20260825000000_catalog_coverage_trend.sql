-- BOI Fix Brief (2026-08-24/25), Phase 4.1 -- real trend logging for
-- CatalogCoverage (technical-hygiene.mjs check 8f).
--
-- No persisted history existed for this metric before now -- "RowCounts
-- (trend log)" in technical-hygiene.mjs's own header comment turned out to
-- mean "visible across successive weekly emails," not a real structured
-- table; there was nothing to query for a week-over-week comparison.
-- Confirmed live baseline (2026-08-25): 1,677/18,599 buildable sets (9%)
-- missing pieces data, 0/18,599 missing year data.

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
