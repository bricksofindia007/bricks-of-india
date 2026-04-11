-- Bricks of India — Supabase Schema
-- Run this in the Supabase SQL editor

-- Sets table
CREATE TABLE IF NOT EXISTS sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT '',
  subtheme TEXT,
  year INTEGER,
  pieces INTEGER,
  minifigs INTEGER,
  image_url TEXT,
  description TEXT,
  age_range TEXT,
  lego_mrp_inr INTEGER,
  rebrickable_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prices table
CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID REFERENCES sets(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  store_url TEXT NOT NULL,
  price_inr INTEGER,
  availability TEXT DEFAULT 'unknown' CHECK (availability IN ('in_stock', 'out_of_stock', 'unknown')),
  buy_url TEXT NOT NULL,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID REFERENCES sets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  verdict TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  youtube_url TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Buying Guides',
  excerpt TEXT NOT NULL,
  hero_image TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- News articles table
CREATE TABLE IF NOT EXISTS news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'New Sets',
  excerpt TEXT NOT NULL,
  hero_image TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Newsletter subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sets_set_number ON sets(set_number);
CREATE INDEX IF NOT EXISTS idx_sets_theme ON sets(theme);
CREATE INDEX IF NOT EXISTS idx_sets_year ON sets(year DESC);
CREATE INDEX IF NOT EXISTS idx_prices_set_id ON prices(set_id);
CREATE INDEX IF NOT EXISTS idx_prices_store_name ON prices(store_name);
CREATE INDEX IF NOT EXISTS idx_prices_scraped_at ON prices(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_prices_is_active ON prices(is_active);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_slug ON news_articles(slug);
CREATE INDEX IF NOT EXISTS idx_news_articles_published ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_slug ON reviews(slug);

-- Row Level Security (allow public read, service key for write)
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read sets" ON sets FOR SELECT USING (true);
CREATE POLICY "Public read prices" ON prices FOR SELECT USING (true);
CREATE POLICY "Public read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Public read blog_posts" ON blog_posts FOR SELECT USING (true);
CREATE POLICY "Public read news_articles" ON news_articles FOR SELECT USING (true);

-- Newsletter — allow public insert (for signup form)
CREATE POLICY "Public insert newsletter" ON newsletter_subscribers FOR INSERT WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sets_updated_at BEFORE UPDATE ON sets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
