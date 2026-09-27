-- EXPORTED from production supabase_migrations.schema_migrations (27 Sep 2026, FP2.3 prep).
-- version 20260627185825, name news_articles_review_schema_fields, created_by bricksofindia007@gmail.com, 1 statement(s), joined verbatim below.
-- History record only: never applied from here (the baseline replaces it).

-- Add verdict + set_number to news_articles so category='Review' rows can carry
-- structured Review/Product JSON-LD (parity with the dedicated reviews table).
-- Nullable — only populated for category='Review'.
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS verdict text;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS set_number text;
