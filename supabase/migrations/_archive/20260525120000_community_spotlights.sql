-- WEB-06: /community route — builder spotlight content table
-- Fan CoLab hard deadline: June 7, 2026
CREATE TABLE IF NOT EXISTS community_spotlights (
  id           bigint primary key generated always as identity,
  slug         text unique not null,
  builder_name text not null,
  location     text,
  bio          text,
  photos       jsonb not null default '[]'::jsonb,
  published_at timestamptz not null default now(),
  published    bool not null default false
);

ALTER TABLE community_spotlights ENABLE ROW LEVEL SECURITY;

-- Public can read published spotlights only
CREATE POLICY "public can read published spotlights" ON community_spotlights
  FOR SELECT USING (published = true);
