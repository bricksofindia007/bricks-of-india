-- Add verdict + set_number to news_articles so category='Review' rows can carry
-- structured Review/Product JSON-LD (parity with the dedicated reviews table).
-- Nullable — only populated for category='Review'. Already applied live and
-- backfilled for the 13 existing review articles that have a verdict
-- (2026-06-28) — this file documents what's already in production.
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS verdict text;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS set_number text;
