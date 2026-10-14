-- Content quality monitor issue tracking table

CREATE TABLE IF NOT EXISTS content_quality_issues (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  checked_at   timestamptz DEFAULT now(),
  article_id   uuid,
  article_slug text,
  section      text,
  check_name   text,
  severity     text        CHECK (severity IN ('critical','warning','info')),
  detail       text,
  resolved     boolean     DEFAULT false,
  resolved_at  timestamptz
);

CREATE INDEX ON content_quality_issues (article_slug);
CREATE INDEX ON content_quality_issues (severity, resolved);
CREATE INDEX ON content_quality_issues (checked_at);

ALTER TABLE content_quality_issues ENABLE ROW LEVEL SECURITY;

-- Service role only — no public reads
CREATE POLICY "service role full access" ON content_quality_issues
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
