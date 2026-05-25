-- WEB-05: /guides route — content table for editorial guides
CREATE TABLE IF NOT EXISTS guides (
  id                  bigint primary key generated always as identity,
  slug                text unique not null,
  title               text not null,
  excerpt             text,
  content             text,
  category            text,
  featured_image_url  text,
  read_time_minutes   int,
  published_at        timestamptz default now(),
  updated_at          timestamptz default now()
);

ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- Public can read all guides (no auth required)
CREATE POLICY "public can read guides" ON guides
  FOR SELECT USING (true);
