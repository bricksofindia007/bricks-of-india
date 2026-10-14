-- VID-P4: daily video pipeline log table.
-- Applied directly via Supabase MCP (apply_migration) 2026-07-05; this file
-- is the local record of that change, matching the repo's existing
-- migration-history convention.

CREATE TABLE video_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_title text NOT NULL,
  set_number text NULL,
  store text NOT NULL,
  product_url text NOT NULL,
  price_inr numeric NOT NULL,
  script text NOT NULL,
  script_chars int NOT NULL,
  gate_results jsonb NOT NULL,
  video_path text NOT NULL,
  status text NOT NULL DEFAULT 'rendered'
    CHECK (status IN ('rendered', 'posted_ig', 'posted_yt', 'posted_both', 'discarded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz NULL
);

ALTER TABLE video_posts ENABLE ROW LEVEL SECURITY;
-- Admin-table pattern (matches generator_runs, pending_drafts): RLS enabled,
-- zero policies. service_role bypasses RLS entirely; anon/authenticated get
-- no access at all, by omission rather than an explicit deny policy.
