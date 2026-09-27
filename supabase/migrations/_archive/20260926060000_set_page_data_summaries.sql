-- PR-B (2026-09-26): fold the set_price_summary reads (locked pricing rules
-- R2-R6: MRP anchor, deal tier, best-price stores) into set_page_data, so the
-- set page stays at ONE Supabase request per render (Fix A) instead of adding
-- two more (this set's summary + the related sets' summaries).
--
-- Same function as 20260926030000 plus two keys: 'summary' and
-- 'related_summaries'. Requires the view from 20260926020000. STABLE,
-- SECURITY INVOKER, EXECUTE for service_role only (the view is SELECT-only for
-- service_role, which is the caller). Projected DB size impact: 0 bytes.

CREATE OR REPLACE FUNCTION public.set_page_data(p_set_number text, p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH s AS (
    SELECT * FROM public.sets WHERE set_number = p_set_number LIMIT 1
  ),
  rel AS (
    SELECT r.id, r.set_number, r.name, r.theme, r.year, r.pieces, r.image_url,
           r.age_range, r.lego_mrp_inr, r.mrp_verified
    FROM public.sets r, s
    WHERE s.theme IS NOT NULL AND s.theme <> ''
      AND r.theme = s.theme AND r.set_number <> s.set_number
    ORDER BY r.year DESC NULLS LAST, r.set_number DESC
    LIMIT 4
  ),
  pat AS (SELECT '%](/sets/' || p_slug || ')%' AS p)
  SELECT jsonb_build_object(
    'set', (
      SELECT to_jsonb(s) || jsonb_build_object('reviews', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'slug', rv.slug, 'rating', rv.rating, 'verdict', rv.verdict,
                 'youtube_url', rv.youtube_url, 'excerpt', rv.excerpt)
               ORDER BY rv.published_at DESC NULLS LAST)
        FROM public.reviews rv WHERE rv.set_id = s.id), '[]'::jsonb))
      FROM s
    ),
    'store_prices', coalesce((
      SELECT jsonb_agg(to_jsonb(sp) ORDER BY sp.store_id)
      FROM public.store_prices sp WHERE sp.set_id = p_set_number), '[]'::jsonb),
    'related', coalesce((SELECT jsonb_agg(to_jsonb(rel)) FROM rel), '[]'::jsonb),
    'related_prices', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'set_id', rp.set_id, 'price_inr', rp.price_inr, 'store_id', rp.store_id,
               'product_url', rp.product_url, 'in_stock', rp.in_stock, 'scraped_at', rp.scraped_at))
      FROM public.store_prices rp WHERE rp.set_id IN (SELECT set_number FROM rel)), '[]'::jsonb),
    'summary', (SELECT to_jsonb(v) FROM public.set_price_summary v WHERE v.set_id = p_set_number),
    'related_summaries', coalesce((
      SELECT jsonb_agg(to_jsonb(v))
      FROM public.set_price_summary v WHERE v.set_id IN (SELECT set_number FROM rel)), '[]'::jsonb),
    'coverage', jsonb_build_object(
      'news', coalesce((
        SELECT jsonb_agg(jsonb_build_object('slug', n.slug, 'title', n.title,
                                            'published_at', n.published_at, 'category', n.category))
        FROM public.news_articles n, pat WHERE n.content ILIKE pat.p), '[]'::jsonb),
      'guides', coalesce((
        SELECT jsonb_agg(jsonb_build_object('slug', g.slug, 'title', g.title, 'published_at', g.published_at))
        FROM public.guides g, pat WHERE g.content ILIKE pat.p), '[]'::jsonb),
      'reviews', coalesce((
        SELECT jsonb_agg(jsonb_build_object('slug', r2.slug, 'title', r2.title, 'published_at', r2.published_at))
        FROM public.reviews r2, pat WHERE r2.content ILIKE pat.p), '[]'::jsonb)
    )
  );
$$;

COMMENT ON FUNCTION public.set_page_data(text, text) IS
  'Everything /sets/[slug] renders, in one read-only call (Fix A + PR-B summaries, 2026-09-26). See migrations 20260926030000, 20260926060000.';

REVOKE ALL ON FUNCTION public.set_page_data(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_page_data(text, text) TO service_role;
