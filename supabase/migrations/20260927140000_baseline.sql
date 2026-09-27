-- FP2.3 BASELINE (draft, P1 Step 7; regenerated P2 Step 9 to include FP5.7, 27 Sep 2026). DO NOT APPLY TO PRODUCTION.
--
-- Production schema as of 20260927135145 (69 schema_migrations rows, the last
-- being FP5.7). It replaces the 57 archived files (supabase/migrations/_archive/)
-- and the 69-row history exported verbatim to supabase/migrations/_history/.
--
-- Built from: pg_dump 17.6 --schema-only --schema=public --schema=growth against
-- production (server 17.6), then:
--   * psql-only \restrict / \unrestrict lines removed (the CLI runs plain SQL)
--   * CREATE SCHEMA -> CREATE SCHEMA IF NOT EXISTS (public exists on every project)
--   * 12 "ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin" lines commented out:
--     only supabase_admin can set them, and every new Supabase project already has them
--   * extensions, storage buckets and the pg_cron job added (pg_dump -n omits them)
--
-- Prerequisite: supabase/roles.sql (growth LOGIN roles, no passwords) must run first,
-- because this file GRANTs to those roles.
--
-- Rehearsal (D-8, #327, needs the staging project from 29 Sep): apply roles.sql and
-- this file to an empty staging DB, then `pg_dump --schema-only -n public -n growth`
-- both sides and diff. Expect 0 differences except the lines listed in the PR.
-- Production repair (P2): record this version as applied with
-- `supabase migration repair --status applied <version>` ONLY after the rehearsal is clean.

-- ── Extensions (versions as in production 27 Sep) ────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;  -- 1.11
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;          -- 1.1
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;             -- 1.3
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;                  -- 1.6 (in public in production; the lint flags it, a separate item)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;                 -- 1.6 (FP3.0)
CREATE EXTENSION IF NOT EXISTS pg_cron;                                     -- 1.6.4 (pg_catalog; enable under Integrations on a new project)

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: growth; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA IF NOT EXISTS growth;


ALTER SCHEMA growth OWNER TO postgres;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: assign_quiet_panic_sequence_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.assign_quiet_panic_sequence_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.sequence_number IS NULL THEN
    SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO NEW.sequence_number FROM quiet_panic_posts;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.assign_quiet_panic_sequence_number() OWNER TO postgres;

--
-- Name: assign_story_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.assign_story_number() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.story_number IS NULL THEN
    NEW.story_number := nextval('public.video_posts_story_number_seq');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.assign_story_number() OWNER TO postgres;

--
-- Name: capacity_snapshot(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.capacity_snapshot(p_days integer DEFAULT 40) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_calls bigint;
  v_reset timestamptz;
BEGIN
  SELECT coalesce(sum(s.calls), 0) INTO v_calls
  FROM extensions.pg_stat_statements s
  JOIN pg_roles r ON r.oid = s.userid
  WHERE r.rolname IN ('anon', 'authenticated', 'service_role');

  SELECT stats_reset INTO v_reset FROM extensions.pg_stat_statements_info;

  INSERT INTO public.capacity_usage_snapshots (taken_at, api_calls, stats_reset)
  VALUES (now(), v_calls, v_reset)
  ON CONFLICT (taken_at) DO NOTHING;

  DELETE FROM public.capacity_usage_snapshots WHERE taken_at < now() - interval '100 days';

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('taken_at', taken_at, 'api_calls', api_calls, 'stats_reset', stats_reset) ORDER BY taken_at)
    FROM public.capacity_usage_snapshots
    WHERE taken_at >= now() - make_interval(days => p_days)
  ), '[]'::jsonb);
END;
$$;


ALTER FUNCTION public.capacity_snapshot(p_days integer) OWNER TO postgres;

--
-- Name: FUNCTION capacity_snapshot(p_days integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.capacity_snapshot(p_days integer) IS 'Snapshot API-role pg_stat_statements calls for the capacity guard (health-check.mjs Check 11). See migration 20260926050000.';


--
-- Name: check_qp_posts_title_consistency(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_qp_posts_title_consistency() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
  canonical_name text;
  stopwords text[] := ARRAY['lego','icons','technic','ideas','art','editions','edition','set','sets','kit',
                             'building','model','models','collection','collections','toy','toys','pieces',
                             'piece','gift','sports','for','adults','the','a','of','and','r'];
  title_words text[];
  canon_words text[];
  overlap_count int;
  failed_gates text;
BEGIN
  IF NEW.mismatch_override THEN
    NEW.title_number_mismatch := false;
    IF NEW.title_mismatch_detail IS NULL OR NEW.title_mismatch_detail NOT LIKE 'Manually cleared:%' THEN
      NEW.title_mismatch_detail := COALESCE('Manually cleared: ' || NEW.override_reason, 'Manually cleared by human review.');
    END IF;
  ELSE
    SELECT name INTO canonical_name FROM sets WHERE set_number = NEW.set_number LIMIT 1;

    IF canonical_name IS NULL THEN
      NEW.title_number_mismatch := false;
      NEW.title_mismatch_detail := NULL;
    ELSE
      SELECT array_agg(DISTINCT w) INTO title_words
      FROM unnest(string_to_array(lower(regexp_replace(NEW.set_title, '[^a-zA-Z0-9]+', ' ', 'g')), ' ')) w
      WHERE w <> '' AND length(w) >= 3 AND w !~ '^[0-9]+$' AND NOT (w = ANY(stopwords));

      SELECT array_agg(DISTINCT w) INTO canon_words
      FROM unnest(string_to_array(lower(regexp_replace(canonical_name, '[^a-zA-Z0-9]+', ' ', 'g')), ' ')) w
      WHERE w <> '' AND length(w) >= 3 AND w !~ '^[0-9]+$' AND NOT (w = ANY(stopwords));

      SELECT count(*) INTO overlap_count FROM unnest(title_words) t WHERE t = ANY(canon_words);

      IF overlap_count > 0 OR canon_words IS NULL THEN
        NEW.title_number_mismatch := false;
        NEW.title_mismatch_detail := NULL;
      ELSE
        NEW.title_number_mismatch := true;
        NEW.title_mismatch_detail := format(
          'set_title "%s" shares no distinctive words with master sets.name "%s" for set_number %s',
          NEW.set_title, canonical_name, NEW.set_number
        );
      END IF;
    END IF;
  END IF;

  IF NOT NEW.gate_override AND NEW.gate_results IS NOT NULL THEN
    SELECT string_agg(key, ', ') INTO failed_gates
    FROM jsonb_each(NEW.gate_results) AS g(key, value)
    WHERE value ? 'pass' AND (value->>'pass')::boolean = false;
  ELSE
    failed_gates := NULL;
  END IF;

  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')
     AND (NEW.title_number_mismatch OR NEW.needs_rerender OR failed_gates IS NOT NULL) THEN
    RAISE EXCEPTION 'Cannot approve quiet_panic_posts row (sequence_number %): title_number_mismatch=%, needs_rerender=%, failed_gates=%. Detail: % / %',
      NEW.sequence_number, NEW.title_number_mismatch, NEW.needs_rerender, failed_gates,
      NEW.title_mismatch_detail, NEW.rerender_note;
  END IF;

  RETURN NEW;
END;
$_$;


ALTER FUNCTION public.check_qp_posts_title_consistency() OWNER TO postgres;

--
-- Name: check_video_posts_title_consistency(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_video_posts_title_consistency() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
  canonical_name text;
  stopwords text[] := ARRAY['lego','icons','technic','ideas','art','editions','edition','set','sets','kit',
                             'building','model','models','collection','collections','toy','toys','pieces',
                             'piece','gift','sports','for','adults','the','a','of','and','r'];
  title_words text[];
  canon_words text[];
  overlap_count int;
  failed_gates text;
BEGIN
  IF NEW.mismatch_override THEN
    NEW.title_number_mismatch := false;
    IF NEW.title_mismatch_detail IS NULL OR NEW.title_mismatch_detail NOT LIKE 'Manually cleared:%' THEN
      NEW.title_mismatch_detail := COALESCE('Manually cleared: ' || NEW.override_reason, 'Manually cleared by human review.');
    END IF;
  ELSE
    SELECT name INTO canonical_name FROM sets WHERE set_number = NEW.set_number LIMIT 1;

    IF canonical_name IS NULL THEN
      NEW.title_number_mismatch := false;
      NEW.title_mismatch_detail := NULL;
    ELSE
      SELECT array_agg(DISTINCT w) INTO title_words
      FROM unnest(string_to_array(lower(regexp_replace(NEW.set_title, '[^a-zA-Z0-9]+', ' ', 'g')), ' ')) w
      WHERE w <> '' AND length(w) >= 3 AND w !~ '^[0-9]+$' AND NOT (w = ANY(stopwords));

      SELECT array_agg(DISTINCT w) INTO canon_words
      FROM unnest(string_to_array(lower(regexp_replace(canonical_name, '[^a-zA-Z0-9]+', ' ', 'g')), ' ')) w
      WHERE w <> '' AND length(w) >= 3 AND w !~ '^[0-9]+$' AND NOT (w = ANY(stopwords));

      SELECT count(*) INTO overlap_count FROM unnest(title_words) t WHERE t = ANY(canon_words);

      IF overlap_count > 0 OR canon_words IS NULL THEN
        NEW.title_number_mismatch := false;
        NEW.title_mismatch_detail := NULL;
      ELSE
        NEW.title_number_mismatch := true;
        NEW.title_mismatch_detail := format(
          'set_title "%s" shares no distinctive words with master sets.name "%s" for set_number %s',
          NEW.set_title, canonical_name, NEW.set_number
        );
      END IF;
    END IF;
  END IF;

  -- NEW: check gate_results itself for any real failure, unless explicitly overridden
  IF NOT NEW.gate_override AND NEW.gate_results IS NOT NULL THEN
    SELECT string_agg(key, ', ') INTO failed_gates
    FROM jsonb_each(NEW.gate_results) AS g(key, value)
    WHERE value ? 'pass' AND (value->>'pass')::boolean = false;
  ELSE
    failed_gates := NULL;
  END IF;

  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')
     AND (NEW.title_number_mismatch OR NEW.needs_rerender OR failed_gates IS NOT NULL) THEN
    RAISE EXCEPTION 'Cannot approve story_number %: title_number_mismatch=%, needs_rerender=%, failed_gates=%. Detail: % / %',
      NEW.story_number, NEW.title_number_mismatch, NEW.needs_rerender, failed_gates,
      NEW.title_mismatch_detail, NEW.rerender_note;
  END IF;

  RETURN NEW;
END;
$_$;


ALTER FUNCTION public.check_video_posts_title_consistency() OWNER TO postgres;

--
-- Name: classify_rejection_reason(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.classify_rejection_reason(p_reason text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RETURN 'other';
  END IF;

  IF p_reason ~* '(price|pricing|mrp|cost|rupee)' THEN
    RETURN 'pricing';
  ELSIF p_reason ~* '(piece count|piece|pieces|part count|parts)' THEN
    RETURN 'piece_count';
  ELSIF p_reason ~* '(wrong set|set number|theme|title|set name|set detail)' THEN
    RETURN 'set_details';
  ELSIF p_reason ~* '(voice|audio|tts|narrat|pronoun)' THEN
    RETURN 'voice_quality';
  ELSE
    RETURN 'other';
  END IF;
END;
$$;


ALTER FUNCTION public.classify_rejection_reason(p_reason text) OWNER TO postgres;

--
-- Name: clear_regeneration_priority_on_requeue(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.clear_regeneration_priority_on_requeue() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE content_rejections
  SET regeneration_priority = false,
      requeued_at = now()
  WHERE set_number = NEW.set_number
    AND review_status = 'cleared_for_regeneration'
    AND regeneration_priority = true;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.clear_regeneration_priority_on_requeue() OWNER TO postgres;

--
-- Name: compute_index_tier(text, text, integer, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.compute_index_tier(p_name text, p_theme text, p_year integer, p_has_price boolean) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  tier3_keywords text := '(key.?chain|key.?light|bag.?tag|\ywatch\y|\ydvd\y|sticker|d.?tickers|backpack|lunch.?box|notebook|hoodie|t.?shirt|sweatshirt|\ymug\y|plush|battery.?pack|connector.?pegs|\yaxles?\y|bricks.?pack|modulex|\ywire\y|extension|building.?plates)';
  book_merch_themes text[] := ARRAY['Story Books','Activity Books with LEGO Parts','Activity Books','Non-fiction Books','Ideas Books'];
  core_retail_themes text[] := ARRAY[
    'Star Wars','Technic','Friends','Ninjago','Creator 3-in-1','Harry Potter','Icons','Speed Champions',
    'Disney','Minecraft','Brickheadz','Botanicals','City','LEGO Ideas and CUUSOO','Spider-Man',
    'The Infinity Saga','Disney Princess','Jurassic World','Editions','Batman','Duplo','Police','Fortnite',
    'Bluey','Classic','Construction','Super Mario','LEGO Art','Creator','Frozen','Christmas','Peppa Pig',
    'Trains','Easter','Ultimate Collector Series','Avengers','Architecture','One Piece','Valentine','Town',
    'Airport','Fire','Modular Buildings','Space','Toy Story','Seasonal','Chinese Traditional Festivals',
    'Arctic','X-Men','Gabby''s Dollhouse','Wednesday','Marvel','Coast Guard','Super Heroes Marvel',
    'Off-Road','Jungle','Farm','Halloween','Chinese (Lunar) New Year','Captain America','Hospital'
  ];
BEGIN
  IF lower(coalesce(p_name, '')) ~* tier3_keywords
     OR lower(coalesce(p_theme, '')) ~* tier3_keywords
     OR p_theme = ANY(book_merch_themes)
  THEN
    RETURN 'tier3';
  END IF;

  IF p_year >= 2023 AND p_has_price AND p_theme = ANY(core_retail_themes) THEN
    RETURN 'tier1';
  END IF;

  RETURN 'tier2';
END;
$$;


ALTER FUNCTION public.compute_index_tier(p_name text, p_theme text, p_year integer, p_has_price boolean) OWNER TO postgres;

--
-- Name: db_usage_report(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.db_usage_report() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  SELECT jsonb_build_object(
    'db_size_mb', round(pg_database_size(current_database()) / 1048576.0, 1),
    'storage_mb', (SELECT round(coalesce(sum((metadata->>'size')::bigint), 0) / 1048576.0, 1) FROM storage.objects),
    'storage_by_bucket', (SELECT coalesce(jsonb_object_agg(bucket_id, mb), '{}'::jsonb) FROM (
        SELECT bucket_id, round(sum((metadata->>'size')::bigint) / 1048576.0, 1) AS mb
        FROM storage.objects GROUP BY bucket_id) b)
  );
$$;


ALTER FUNCTION public.db_usage_report() OWNER TO postgres;

--
-- Name: get_distinct_themes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_distinct_themes() RETURNS TABLE(theme text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT DISTINCT s.theme
  FROM   sets s
  WHERE  s.theme IS NOT NULL
    AND  s.theme <> ''
  ORDER  BY s.theme;
$$;


ALTER FUNCTION public.get_distinct_themes() OWNER TO postgres;

--
-- Name: price_history_on_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.price_history_on_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.price_inr IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT'
     OR NEW.price_inr IS DISTINCT FROM OLD.price_inr
     OR NEW.in_stock  IS DISTINCT FROM OLD.in_stock THEN
    INSERT INTO public.price_history (set_id, store_id, price_inr, in_stock, recorded_at)
    VALUES (
      NEW.set_id, NEW.store_id, NEW.price_inr, NEW.in_stock,
      CASE
        WHEN TG_OP = 'UPDATE' AND NEW.scraped_at IS NOT DISTINCT FROM OLD.scraped_at THEN now()
        ELSE COALESCE(NEW.scraped_at, now())
      END
    );
  END IF;
  RETURN NEW;
END
$$;


ALTER FUNCTION public.price_history_on_change() OWNER TO postgres;

--
-- Name: reconcile_page_load_errors(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reconcile_page_load_errors() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  total_articles integer;
  latest_batch timestamptz;
  prior_batch timestamptz;
  is_systemic boolean;
BEGIN
  SELECT
    (SELECT count(*) FROM public.reviews) +
    (SELECT count(*) FROM public.blog_posts) +
    (SELECT count(*) FROM public.news_articles) +
    (SELECT count(*) FROM public.guides)
  INTO total_articles;

  SELECT max(checked_at) INTO latest_batch
  FROM public.content_quality_issues
  WHERE check_name = 'page_load_error' AND resolved = false AND reconciled_at IS NULL;

  IF latest_batch IS NULL THEN
    RETURN;
  END IF;

  SELECT max(checked_at) INTO prior_batch
  FROM public.content_quality_issues
  WHERE check_name = 'page_load_error' AND checked_at < latest_batch;

  SELECT (count(DISTINCT article_slug)::float / GREATEST(total_articles, 1)) > 0.15
  INTO is_systemic
  FROM public.content_quality_issues
  WHERE check_name = 'page_load_error' AND checked_at = latest_batch;

  IF is_systemic THEN
    UPDATE public.content_quality_issues
    SET suspected_false_positive = true,
        original_severity = coalesce(original_severity, severity),
        resolved = true,
        resolved_at = now(),
        fix_detail = format(
          'Auto-reconciled: %s%% of live articles (%s of %s) failed page_load_error in this single scan batch — statistically a scanner/WAF/rate-limit block, not simultaneous content outages. Not a real content issue.',
          round(100.0 * (SELECT count(DISTINCT article_slug) FROM public.content_quality_issues WHERE check_name='page_load_error' AND checked_at = latest_batch)::numeric / GREATEST(total_articles,1), 1),
          (SELECT count(DISTINCT article_slug) FROM public.content_quality_issues WHERE check_name='page_load_error' AND checked_at = latest_batch),
          total_articles
        ),
        reconciled_at = now()
    WHERE check_name = 'page_load_error' AND checked_at = latest_batch;
  ELSE
    UPDATE public.content_quality_issues cur
    SET suspected_false_positive = NOT EXISTS (
          SELECT 1 FROM public.content_quality_issues prev
          WHERE prev.check_name = 'page_load_error'
            AND prev.checked_at = prior_batch
            AND prev.article_slug = cur.article_slug
            AND prev.detail = cur.detail
        ),
        original_severity = CASE WHEN NOT EXISTS (
          SELECT 1 FROM public.content_quality_issues prev
          WHERE prev.check_name = 'page_load_error'
            AND prev.checked_at = prior_batch
            AND prev.article_slug = cur.article_slug
            AND prev.detail = cur.detail
        ) THEN coalesce(cur.original_severity, cur.severity) ELSE cur.original_severity END,
        resolved = CASE WHEN NOT EXISTS (
          SELECT 1 FROM public.content_quality_issues prev
          WHERE prev.check_name = 'page_load_error'
            AND prev.checked_at = prior_batch
            AND prev.article_slug = cur.article_slug
            AND prev.detail = cur.detail
        ) THEN true ELSE cur.resolved END,
        resolved_at = CASE WHEN NOT EXISTS (
          SELECT 1 FROM public.content_quality_issues prev
          WHERE prev.check_name = 'page_load_error'
            AND prev.checked_at = prior_batch
            AND prev.article_slug = cur.article_slug
            AND prev.detail = cur.detail
        ) THEN now() ELSE cur.resolved_at END,
        fix_detail = CASE WHEN NOT EXISTS (
          SELECT 1 FROM public.content_quality_issues prev
          WHERE prev.check_name = 'page_load_error'
            AND prev.checked_at = prior_batch
            AND prev.article_slug = cur.article_slug
            AND prev.detail = cur.detail
        ) THEN 'Auto-reconciled: single-batch failure, not confirmed on the prior scan run. Held as unverified pending a second consecutive failure before being treated as a real outage.'
        ELSE cur.fix_detail END,
        reconciled_at = now()
    WHERE cur.check_name = 'page_load_error' AND cur.checked_at = latest_batch;
  END IF;
END;
$$;


ALTER FUNCTION public.reconcile_page_load_errors() OWNER TO postgres;

--
-- Name: reject_video_post(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reject_video_post(p_video_id uuid, p_reason text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_current_status text;
  v_set_number     text;
  v_set_title      text;
  v_story_number   integer;
  v_rejection_id   uuid;
  v_category       text;
BEGIN
  SELECT status, set_number, set_title, story_number
    INTO v_current_status, v_set_number, v_set_title, v_story_number
    FROM video_posts
    WHERE id = p_video_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'video_posts row % not found', p_video_id;
  END IF;

  IF v_current_status = 'discarded' THEN
    RAISE EXCEPTION 'video_posts row % is already discarded -- call reject_video_post exactly once per rejection', p_video_id;
  END IF;

  UPDATE video_posts SET status = 'discarded' WHERE id = p_video_id;

  v_category := classify_rejection_reason(p_reason);

  INSERT INTO content_rejections
    (video_post_id, set_number, set_title, story_number, rejection_reason, rejection_category)
  VALUES
    (p_video_id, v_set_number, v_set_title, v_story_number, p_reason, v_category)
  RETURNING id INTO v_rejection_id;

  -- §2 auto-verification routing: for the three catalog-data-adjacent
  -- categories, flag the set for re-verification via the existing MRP-audit
  -- queue (sets.mrp_verified/mrp_review_reason) rather than building a
  -- separate re-verification surface. Only if mrp_verified was previously
  -- true -- a row already false/'unverified_estimate' is already correctly
  -- queued, and this must not clobber a more specific existing reason (e.g.
  -- 'cmf_box_ambiguity'). Does NOT touch the price itself -- that still
  -- requires a live retailer lookup by a human or chat/terminal Claude.
  IF v_category IN ('pricing', 'piece_count', 'set_details') AND v_set_number IS NOT NULL THEN
    UPDATE sets
    SET mrp_verified = false,
        mrp_review_reason = 'operator_flagged_incorrect'
    WHERE set_number = v_set_number
      AND mrp_verified = true;
  END IF;

  RETURN v_rejection_id;
END;
$$;


ALTER FUNCTION public.reject_video_post(p_video_id uuid, p_reason text) OWNER TO postgres;

--
-- Name: reserve_story_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reserve_story_number() RETURNS integer
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  SELECT nextval('public.video_posts_story_number_seq')::integer;
$$;


ALTER FUNCTION public.reserve_story_number() OWNER TO postgres;

--
-- Name: run_retention(integer, integer, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.run_retention(p_days integer DEFAULT 30, p_archive_days integer DEFAULT 90, p_dry_run boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    SET statement_timeout TO '55s'
    AS $$
DECLARE
  cutoff  timestamptz := now() - make_interval(days => p_days);
  acutoff timestamptz := now() - make_interval(days => p_archive_days);
  n_ph  bigint;
  n_rs  bigint;
  n_cir bigint;
  n_arc bigint;
BEGIN
  IF p_days < 30 OR p_archive_days < 90 THEN
    RAISE EXCEPTION 'run_retention: refusing p_days=% p_archive_days=% (minimums 30/90)', p_days, p_archive_days;
  END IF;

  IF p_dry_run THEN
    SELECT count(*) INTO n_ph FROM (
      SELECT recorded_at, price_inr,
             lag(price_inr)  OVER w AS prev_p, lead(price_inr) OVER w AS next_p,
             row_number() OVER w AS rn, count(*) OVER (PARTITION BY set_id, store_id) AS cnt
      FROM price_history
      WINDOW w AS (PARTITION BY set_id, store_id ORDER BY recorded_at, id)
    ) o
    WHERE o.recorded_at < cutoff AND o.rn > 1 AND o.rn < o.cnt
      AND o.prev_p IS NOT DISTINCT FROM o.price_inr AND o.next_p IS NOT DISTINCT FROM o.price_inr;
    SELECT count(*) INTO n_rs FROM raw_signals
      WHERE created_at < cutoff AND (body IS NOT NULL OR raw_payload IS NOT NULL);
    SELECT count(*) INTO n_cir FROM (
      SELECT row_number() OVER (PARTITION BY article_slug, section, image_url ORDER BY checked_at DESC, id DESC) AS rn
      FROM content_image_registry
    ) r WHERE r.rn > 1;
    SELECT count(*) INTO n_arc FROM content_quality_issues_archive WHERE resolved_at < acutoff;
  ELSE
    WITH o AS (
      SELECT id, recorded_at, price_inr,
             lag(price_inr)  OVER w AS prev_p, lead(price_inr) OVER w AS next_p,
             row_number() OVER w AS rn, count(*) OVER (PARTITION BY set_id, store_id) AS cnt
      FROM price_history
      WINDOW w AS (PARTITION BY set_id, store_id ORDER BY recorded_at, id)
    )
    DELETE FROM price_history ph USING o
    WHERE ph.id = o.id AND o.recorded_at < cutoff AND o.rn > 1 AND o.rn < o.cnt
      AND o.prev_p IS NOT DISTINCT FROM o.price_inr AND o.next_p IS NOT DISTINCT FROM o.price_inr;
    GET DIAGNOSTICS n_ph = ROW_COUNT;

    UPDATE raw_signals SET body = NULL, raw_payload = NULL
    WHERE created_at < cutoff AND (body IS NOT NULL OR raw_payload IS NOT NULL);
    GET DIAGNOSTICS n_rs = ROW_COUNT;

    WITH r AS (
      SELECT id, row_number() OVER (PARTITION BY article_slug, section, image_url
                                    ORDER BY checked_at DESC, id DESC) AS rn
      FROM content_image_registry
    )
    DELETE FROM content_image_registry c USING r WHERE c.id = r.id AND r.rn > 1;
    GET DIAGNOSTICS n_cir = ROW_COUNT;

    DELETE FROM content_quality_issues_archive WHERE resolved_at < acutoff;
    GET DIAGNOSTICS n_arc = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run, 'cutoff', cutoff, 'archive_cutoff', acutoff,
    'price_history_deleted', n_ph, 'raw_signals_nulled', n_rs,
    'content_image_registry_deleted', n_cir, 'content_quality_issues_archive_deleted', n_arc,
    'db_size_mb', round(pg_database_size(current_database()) / 1048576.0, 1)
  );
END;
$$;


ALTER FUNCTION public.run_retention(p_days integer, p_archive_days integer, p_dry_run boolean) OWNER TO postgres;

--
-- Name: set_approved_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_approved_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_approved_at() OWNER TO postgres;

--
-- Name: set_page_data(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_page_data(p_set_number text, p_slug text) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
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


ALTER FUNCTION public.set_page_data(p_set_number text, p_slug text) OWNER TO postgres;

--
-- Name: FUNCTION set_page_data(p_set_number text, p_slug text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.set_page_data(p_set_number text, p_slug text) IS 'Everything /sets/[slug] renders, in one read-only call (Fix A + PR-B summaries, 2026-09-26). See migrations 20260926030000, 20260926060000.';


--
-- Name: sets_bulk_patch(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sets_bulk_patch(p_rows jsonb) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  n_id integer;
  n_num integer;
BEGIN
  UPDATE public.sets s SET
    lego_mrp_inr    = CASE WHEN x.r ? 'lego_mrp_inr'    THEN (x.r->>'lego_mrp_inr')::integer ELSE s.lego_mrp_inr END,
    retirement_date = CASE WHEN x.r ? 'retirement_date' THEN (x.r->>'retirement_date')::date   ELSE s.retirement_date END
  FROM (SELECT r FROM jsonb_array_elements(p_rows) AS r WHERE r ? 'id') AS x
  WHERE s.id = (x.r->>'id')::uuid;
  GET DIAGNOSTICS n_id = ROW_COUNT;

  UPDATE public.sets s SET
    lego_mrp_inr    = CASE WHEN x.r ? 'lego_mrp_inr'    THEN (x.r->>'lego_mrp_inr')::integer ELSE s.lego_mrp_inr END,
    retirement_date = CASE WHEN x.r ? 'retirement_date' THEN (x.r->>'retirement_date')::date   ELSE s.retirement_date END
  FROM (SELECT r FROM jsonb_array_elements(p_rows) AS r WHERE NOT (r ? 'id') AND r ? 'set_number') AS x
  WHERE s.set_number = x.r->>'set_number';
  GET DIAGNOSTICS n_num = ROW_COUNT;

  RETURN n_id + n_num;
END;
$$;


ALTER FUNCTION public.sets_bulk_patch(p_rows jsonb) OWNER TO postgres;

--
-- Name: FUNCTION sets_bulk_patch(p_rows jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.sets_bulk_patch(p_rows jsonb) IS 'Batch lego_mrp_inr (by id) / retirement_date (by set_number) updates in one call. Used by scripts/populate-mrp.js. See migration 20260926040000.';


--
-- Name: sync_index_tier_for_set(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_index_tier_for_set(p_set_number text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_has_price boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM store_prices WHERE set_id = p_set_number AND price_inr IS NOT NULL
  ) INTO v_has_price;

  UPDATE sets
  SET index_tier = compute_index_tier(name, theme, year, v_has_price)
  WHERE set_number = p_set_number
    AND index_tier IS DISTINCT FROM compute_index_tier(name, theme, year, v_has_price);
END;
$$;


ALTER FUNCTION public.sync_index_tier_for_set(p_set_number text) OWNER TO postgres;

--
-- Name: trg_sync_index_tier_on_sets(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_sync_index_tier_on_sets() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM sync_index_tier_for_set(NEW.set_number);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_sync_index_tier_on_sets() OWNER TO postgres;

--
-- Name: trg_sync_index_tier_on_store_prices(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_sync_index_tier_on_store_prices() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM sync_index_tier_for_set(NEW.set_id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_sync_index_tier_on_store_prices() OWNER TO postgres;

--
-- Name: trg_sync_index_tier_on_store_prices_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_sync_index_tier_on_store_prices_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM sync_index_tier_for_set(OLD.set_id);
  RETURN OLD;
END;
$$;


ALTER FUNCTION public.trg_sync_index_tier_on_store_prices_delete() OWNER TO postgres;

--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION public.update_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: content_performance; Type: TABLE; Schema: growth; Owner: postgres
--

CREATE TABLE growth.content_performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform text NOT NULL,
    content_ref text NOT NULL,
    content_theme text,
    content_format text,
    metric_date date NOT NULL,
    views bigint,
    completion_rate numeric,
    engagement bigint,
    pulled_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE growth.content_performance OWNER TO postgres;

--
-- Name: forecasts; Type: TABLE; Schema: growth; Owner: postgres
--

CREATE TABLE growth.forecasts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    track_type text NOT NULL,
    platform text,
    metric text NOT NULL,
    current_value numeric,
    target_value numeric,
    projected_date date,
    confidence text,
    evidence_weeks integer,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending_approval'::text NOT NULL,
    evidence_days integer,
    evidence_met boolean DEFAULT false NOT NULL,
    computed_rate numeric,
    ai_narrative text,
    CONSTRAINT forecasts_confidence_check CHECK ((confidence = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT forecasts_status_check CHECK ((status = ANY (ARRAY['pending_approval'::text, 'approved'::text, 'dismissed'::text]))),
    CONSTRAINT forecasts_track_type_check CHECK ((track_type = ANY (ARRAY['platform_gated'::text, 'owned_channel'::text])))
);


ALTER TABLE growth.forecasts OWNER TO postgres;

--
-- Name: COLUMN forecasts.evidence_weeks; Type: COMMENT; Schema: growth; Owner: postgres
--

COMMENT ON COLUMN growth.forecasts.evidence_weeks IS 'Deprecated as of Phase 3 -- superseded by evidence_days (the evidence bar is defined in days). Left nullable/unused for backward compatibility, not populated going forward.';


--
-- Name: COLUMN forecasts.status; Type: COMMENT; Schema: growth; Owner: postgres
--

COMMENT ON COLUMN growth.forecasts.status IS 'Phase 3/4: pending_approval by default. Only the growth_dashboard role (Phase 4), via its RLS policy, may transition a row to approved or dismissed -- no other code path in this system does.';


--
-- Name: COLUMN forecasts.evidence_days; Type: COMMENT; Schema: growth; Owner: postgres
--

COMMENT ON COLUMN growth.forecasts.evidence_days IS 'Phase 3: count of consecutive real (phase2_nightly/phase2_backfill) days of data as of computed_at, per the evidence-bar definition in docs/architecture.md.';


--
-- Name: COLUMN forecasts.evidence_met; Type: COMMENT; Schema: growth; Owner: postgres
--

COMMENT ON COLUMN growth.forecasts.evidence_met IS 'Phase 3: true only when evidence_days >= the evidence bar. projected_date/computed_rate are null whenever this is false.';


--
-- Name: COLUMN forecasts.computed_rate; Type: COMMENT; Schema: growth; Owner: postgres
--

COMMENT ON COLUMN growth.forecasts.computed_rate IS 'Phase 3: pure-arithmetic rate of change per day over the evidence window (fact, never LLM-derived). Null when evidence not met.';


--
-- Name: COLUMN forecasts.ai_narrative; Type: COMMENT; Schema: growth; Owner: postgres
--

COMMENT ON COLUMN growth.forecasts.ai_narrative IS 'Phase 3: LLM-generated interpretive commentary, kept structurally separate from computed_rate/current_value/target_value/projected_date (fact fields). Never merged with them.';


--
-- Name: ingestion_runs; Type: TABLE; Schema: growth; Owner: postgres
--

CREATE TABLE growth.ingestion_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_type text NOT NULL,
    platform text NOT NULL,
    target_date date NOT NULL,
    status text NOT NULL,
    rows_written integer DEFAULT 0 NOT NULL,
    error_message text,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ingestion_runs_platform_check CHECK ((platform = ANY (ARRAY['youtube'::text, 'instagram'::text, 'reddit'::text, 'website'::text]))),
    CONSTRAINT ingestion_runs_run_type_check CHECK ((run_type = ANY (ARRAY['nightly'::text, 'backfill'::text]))),
    CONSTRAINT ingestion_runs_status_check CHECK ((status = ANY (ARRAY['success'::text, 'partial'::text, 'failure'::text])))
);


ALTER TABLE growth.ingestion_runs OWNER TO postgres;

--
-- Name: insights; Type: TABLE; Schema: growth; Owner: postgres
--

CREATE TABLE growth.insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    metric_fact jsonb NOT NULL,
    ai_commentary text,
    confidence text,
    evidence_weeks integer,
    status text DEFAULT 'new'::text NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT insights_confidence_check CHECK ((confidence = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT insights_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewed'::text, 'actioned'::text, 'dismissed'::text])))
);


ALTER TABLE growth.insights OWNER TO postgres;

--
-- Name: newsletter_drafts; Type: TABLE; Schema: growth; Owner: postgres
--

CREATE TABLE growth.newsletter_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'pending_approval'::text NOT NULL,
    subject text,
    content jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    sent_at timestamp with time zone,
    issue_number integer,
    window_start date,
    window_end date,
    final_html text,
    final_text text,
    sent_count integer,
    resend_broadcast_id text,
    is_test_send boolean DEFAULT false NOT NULL,
    CONSTRAINT newsletter_drafts_status_check CHECK ((status = ANY (ARRAY['pending_approval'::text, 'approved'::text, 'sending'::text, 'sent'::text, 'send_failed'::text, 'dismissed'::text])))
);


ALTER TABLE growth.newsletter_drafts OWNER TO postgres;

--
-- Name: COLUMN newsletter_drafts.content; Type: COMMENT; Schema: growth; Owner: postgres
--

COMMENT ON COLUMN growth.newsletter_drafts.content IS 'Structured block data + LLM-generated copy for every section -- the pre-send draft, rendered fresh for dashboard preview. NOT what actually gets sent.';


--
-- Name: COLUMN newsletter_drafts.final_html; Type: COMMENT; Schema: growth; Owner: postgres
--

COMMENT ON COLUMN growth.newsletter_drafts.final_html IS 'Frozen render of content at the moment of send -- distinct from content because a manual edit could happen between approval and send. NULL until sent.';


--
-- Name: COLUMN newsletter_drafts.final_text; Type: COMMENT; Schema: growth; Owner: postgres
--

COMMENT ON COLUMN growth.newsletter_drafts.final_text IS 'Plain-text counterpart to final_html, frozen at the same moment.';


--
-- Name: newsletter_events; Type: TABLE; Schema: growth; Owner: postgres
--

CREATE TABLE growth.newsletter_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    draft_id uuid,
    recipient_email text NOT NULL,
    event_type text NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    link_url text,
    resend_email_id text,
    svix_id text,
    raw jsonb DEFAULT '{}'::jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT newsletter_events_event_type_check CHECK ((event_type = ANY (ARRAY['sent'::text, 'delivered'::text, 'opened'::text, 'clicked'::text, 'bounced'::text, 'complained'::text, 'unsubscribed'::text])))
);


ALTER TABLE growth.newsletter_events OWNER TO postgres;

--
-- Name: COLUMN newsletter_events.svix_id; Type: COMMENT; Schema: growth; Owner: postgres
--

COMMENT ON COLUMN growth.newsletter_events.svix_id IS 'The svix-id header Resend''s webhook delivery carries -- Resend/Svix can retry a webhook delivery, so this is the real idempotency key (unique constraint + ON CONFLICT DO NOTHING on insert), not resend_email_id+event_type, which is not unique for e.g. multiple distinct link clicks in one issue.';


--
-- Name: newsletter_issue_summary; Type: VIEW; Schema: growth; Owner: postgres
--

CREATE VIEW growth.newsletter_issue_summary WITH (security_invoker='true') AS
 SELECT d.id AS draft_id,
    d.issue_number,
    d.subject,
    d.sent_at,
    count(*) FILTER (WHERE (e.event_type = 'sent'::text)) AS sent_count,
    count(*) FILTER (WHERE (e.event_type = 'delivered'::text)) AS delivered_count,
    count(DISTINCT e.recipient_email) FILTER (WHERE (e.event_type = 'opened'::text)) AS opened_count,
    count(DISTINCT e.recipient_email) FILTER (WHERE (e.event_type = 'clicked'::text)) AS clicked_count,
    count(DISTINCT e.recipient_email) FILTER (WHERE (e.event_type = 'unsubscribed'::text)) AS unsubscribed_count,
    count(*) FILTER (WHERE (e.event_type = 'bounced'::text)) AS bounced_count,
    count(*) FILTER (WHERE (e.event_type = 'complained'::text)) AS complained_count
   FROM (growth.newsletter_drafts d
     LEFT JOIN growth.newsletter_events e ON ((e.draft_id = d.id)))
  WHERE ((d.status = 'sent'::text) AND (d.is_test_send = false))
  GROUP BY d.id, d.issue_number, d.subject, d.sent_at;


ALTER VIEW growth.newsletter_issue_summary OWNER TO postgres;

--
-- Name: platform_metrics_daily; Type: TABLE; Schema: growth; Owner: postgres
--

CREATE TABLE growth.platform_metrics_daily (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform text NOT NULL,
    metric_date date NOT NULL,
    followers_or_subs integer,
    views bigint,
    watch_hours numeric,
    reach bigint,
    engagement bigint,
    raw jsonb,
    pulled_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_metrics_daily_platform_check CHECK ((platform = ANY (ARRAY['youtube'::text, 'instagram'::text, 'reddit'::text, 'website'::text, 'newsletter'::text])))
);


ALTER TABLE growth.platform_metrics_daily OWNER TO postgres;

--
-- Name: reddit_activity; Type: TABLE; Schema: growth; Owner: postgres
--

CREATE TABLE growth.reddit_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subreddit text NOT NULL,
    post_ref text,
    posted_at timestamp with time zone,
    upvotes integer,
    comments integer,
    referral_clicks integer,
    tracked_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE growth.reddit_activity OWNER TO postgres;

--
-- Name: subscribers; Type: TABLE; Schema: growth; Owner: postgres
--

CREATE TABLE growth.subscribers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    source text,
    subscribed_at timestamp with time zone DEFAULT now() NOT NULL,
    source_subscriber_id uuid,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscribers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'unsubscribed'::text, 'bounced'::text])))
);


ALTER TABLE growth.subscribers OWNER TO postgres;

--
-- Name: TABLE subscribers; Type: COMMENT; Schema: growth; Owner: postgres
--

COMMENT ON TABLE growth.subscribers IS 'Read-only mirror of public.newsletter_subscribers (the site''s real signup flow), refreshed by ingestion/subscriber_sync.py via growth_subscriber_sync. status mirrors the source''s is_active only -- actual Resend-driven unsubscribes are tracked separately in growth.newsletter_events and excluded at send-query time, not by mutating this table.';


--
-- Name: COLUMN subscribers.source; Type: COMMENT; Schema: growth; Owner: postgres
--

COMMENT ON COLUMN growth.subscribers.source IS 'Always ''site_signup_mirror'' -- every row is a synced copy, never an independent signup path of its own.';


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    content text NOT NULL,
    category text DEFAULT 'Buying Guides'::text NOT NULL,
    excerpt text NOT NULL,
    hero_image text,
    published_at timestamp with time zone DEFAULT now(),
    seo_title text,
    seo_description text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.blog_posts OWNER TO postgres;

--
-- Name: capacity_usage_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.capacity_usage_snapshots (
    taken_at timestamp with time zone DEFAULT now() NOT NULL,
    api_calls bigint NOT NULL,
    stats_reset timestamp with time zone
);


ALTER TABLE public.capacity_usage_snapshots OWNER TO postgres;

--
-- Name: catalog_coverage_trend; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.catalog_coverage_trend (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    logged_at timestamp with time zone DEFAULT now(),
    total_buildable integer NOT NULL,
    missing_pieces integer NOT NULL,
    missing_pieces_pct numeric NOT NULL,
    missing_year integer NOT NULL,
    missing_year_pct numeric NOT NULL
);


ALTER TABLE public.catalog_coverage_trend OWNER TO postgres;

--
-- Name: cmf_figures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cmf_figures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    figure_number text NOT NULL,
    series_set_number text NOT NULL,
    name text NOT NULL,
    image_url text,
    series_name text NOT NULL,
    year integer,
    figure_index integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    image_source text,
    CONSTRAINT cmf_figures_image_source_check CHECK ((image_source = ANY (ARRAY['brickset'::text, 'rebrickable'::text])))
);


ALTER TABLE public.cmf_figures OWNER TO postgres;

--
-- Name: COLUMN cmf_figures.image_source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cmf_figures.image_source IS 'Which source populated image_url for this row -- brickset (preferred, higher-res) or rebrickable (fallback where Brickset has no image for this exact figure number). See scripts/sync-cmf-figure-images-brickset.mjs.';


--
-- Name: community_spotlights; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.community_spotlights (
    id bigint NOT NULL,
    slug text NOT NULL,
    builder_name text NOT NULL,
    location text,
    bio text,
    photos jsonb DEFAULT '[]'::jsonb NOT NULL,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    published boolean DEFAULT false NOT NULL
);


ALTER TABLE public.community_spotlights OWNER TO postgres;

--
-- Name: community_spotlights_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.community_spotlights ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.community_spotlights_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: content_fix_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.content_fix_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fixed_at timestamp with time zone DEFAULT now(),
    article_slug text,
    section text,
    fix_type text,
    body_before text,
    body_after text,
    issue_id uuid
);


ALTER TABLE public.content_fix_log OWNER TO postgres;

--
-- Name: content_image_registry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.content_image_registry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    checked_at timestamp with time zone DEFAULT now(),
    article_slug text,
    section text,
    image_url text,
    http_status integer,
    is_duplicate boolean DEFAULT false,
    duplicate_of text[]
);


ALTER TABLE public.content_image_registry OWNER TO postgres;

--
-- Name: content_quality_issues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.content_quality_issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    checked_at timestamp with time zone DEFAULT now(),
    article_id uuid,
    article_slug text,
    section text,
    check_name text,
    severity text,
    detail text,
    resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    auto_fixable boolean DEFAULT false,
    fix_detail text,
    suspected_false_positive boolean DEFAULT false NOT NULL,
    reconciled_at timestamp with time zone,
    original_severity text,
    first_seen_at timestamp with time zone,
    CONSTRAINT content_quality_issues_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'warning'::text, 'info'::text])))
);


ALTER TABLE public.content_quality_issues OWNER TO postgres;

--
-- Name: content_quality_issues_archive; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.content_quality_issues_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    checked_at timestamp with time zone DEFAULT now(),
    article_id uuid,
    article_slug text,
    section text,
    check_name text,
    severity text,
    detail text,
    resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    auto_fixable boolean DEFAULT false,
    fix_detail text,
    suspected_false_positive boolean DEFAULT false NOT NULL,
    reconciled_at timestamp with time zone,
    original_severity text,
    first_seen_at timestamp with time zone,
    archived_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_quality_issues_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'warning'::text, 'info'::text])))
);


ALTER TABLE public.content_quality_issues_archive OWNER TO postgres;

--
-- Name: content_rejection_reminders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.content_rejection_reminders (
    id integer DEFAULT 1 NOT NULL,
    last_reminder_sent_at timestamp with time zone,
    CONSTRAINT content_rejection_reminders_id_check CHECK ((id = 1))
);


ALTER TABLE public.content_rejection_reminders OWNER TO postgres;

--
-- Name: content_rejections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.content_rejections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    video_post_id uuid,
    set_number text,
    set_title text,
    story_number integer,
    rejected_at timestamp with time zone DEFAULT now() NOT NULL,
    rejection_reason text,
    review_status text DEFAULT 'pending'::text NOT NULL,
    reviewed_at timestamp with time zone,
    review_notes text,
    rejection_category text,
    regeneration_priority boolean DEFAULT true NOT NULL,
    requeued_at timestamp with time zone,
    CONSTRAINT content_rejections_category_check CHECK (((rejection_category IS NULL) OR (rejection_category = ANY (ARRAY['pricing'::text, 'piece_count'::text, 'set_details'::text, 'voice_quality'::text, 'other'::text])))),
    CONSTRAINT content_rejections_review_status_check CHECK ((review_status = ANY (ARRAY['pending'::text, 'cleared_for_regeneration'::text, 'permanently_excluded'::text])))
);


ALTER TABLE public.content_rejections OWNER TO postgres;

--
-- Name: featured_videos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.featured_videos (
    id bigint NOT NULL,
    youtube_video_id text NOT NULL,
    title text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.featured_videos OWNER TO postgres;

--
-- Name: featured_videos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.featured_videos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.featured_videos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: generator_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.generator_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    trigger text NOT NULL,
    drafts_attempted integer DEFAULT 0 NOT NULL,
    drafts_succeeded integer DEFAULT 0 NOT NULL,
    drafts_lint_failed integer DEFAULT 0 NOT NULL,
    drafts_deferred integer DEFAULT 0 NOT NULL,
    drafts_routed_to_review integer DEFAULT 0 NOT NULL,
    provider_stats jsonb,
    notes text,
    drafts_failed integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.generator_runs OWNER TO postgres;

--
-- Name: TABLE generator_runs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.generator_runs IS 'One row per generator execution. Consumed by health check workflow and CQS backlog monitor.';


--
-- Name: guides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.guides (
    id bigint NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    excerpt text,
    content text,
    category text,
    featured_image_url text,
    read_time_minutes integer,
    published_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    hero_image text,
    seo_title text,
    seo_description text
);


ALTER TABLE public.guides OWNER TO postgres;

--
-- Name: guides_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.guides ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.guides_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: image_repair_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.image_repair_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_slug text NOT NULL,
    section text DEFAULT 'news_articles'::text NOT NULL,
    current_hero_image text,
    recovered_candidate_url text,
    recovery_method text,
    verified boolean DEFAULT false NOT NULL,
    verified_status_code integer,
    applied boolean DEFAULT false NOT NULL,
    applied_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.image_repair_queue OWNER TO postgres;

--
-- Name: news_articles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.news_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    content text NOT NULL,
    category text DEFAULT 'New Sets'::text NOT NULL,
    excerpt text NOT NULL,
    hero_image text,
    published_at timestamp with time zone DEFAULT now(),
    seo_title text,
    seo_description text,
    created_at timestamp with time zone DEFAULT now(),
    verdict text,
    set_number text
);


ALTER TABLE public.news_articles OWNER TO postgres;

--
-- Name: newsletter_subscribers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.newsletter_subscribers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    subscribed_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true
);


ALTER TABLE public.newsletter_subscribers OWNER TO postgres;

--
-- Name: opinion_cadence_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.opinion_cadence_log (
    id bigint NOT NULL,
    cycle_date date NOT NULL,
    path text NOT NULL,
    source_url text,
    pending_draft_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT opinion_cadence_log_path_check CHECK ((path = ANY (ARRAY['keyword_match'::text, 'fallback'::text, 'no_candidate'::text])))
);


ALTER TABLE public.opinion_cadence_log OWNER TO postgres;

--
-- Name: opinion_cadence_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.opinion_cadence_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.opinion_cadence_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pending_drafts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pending_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_url text NOT NULL,
    source_title text NOT NULL,
    source_excerpt text,
    source_published_at timestamp with time zone,
    draft_title text,
    draft_body text,
    draft_verdict text,
    draft_format text,
    word_count integer,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    approved_by text,
    published_url text,
    iteration_label text,
    provider text,
    requires_manual_approval boolean DEFAULT false NOT NULL,
    lint_result jsonb,
    discard_reason text,
    published_at timestamp with time zone,
    draft_rating integer,
    source_retailer text,
    source_price_inr integer,
    source_stock_status text,
    source_checked_at timestamp with time zone,
    opinion_forced_take boolean DEFAULT false NOT NULL,
    draft_category text,
    CONSTRAINT pending_drafts_draft_format_check CHECK ((draft_format = ANY (ARRAY['news'::text, 'review'::text, 'opinion'::text, 'guide'::text]))),
    CONSTRAINT pending_drafts_published_has_url CHECK (((status <> 'published'::text) OR (published_url IS NOT NULL))),
    CONSTRAINT pending_drafts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'rejected'::text, 'published'::text, 'failed_lint'::text])))
);


ALTER TABLE public.pending_drafts OWNER TO postgres;

--
-- Name: COLUMN pending_drafts.provider; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pending_drafts.provider IS 'LLM provider used to generate this draft: gemini | cerebras | manual';


--
-- Name: COLUMN pending_drafts.requires_manual_approval; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pending_drafts.requires_manual_approval IS 'True when provider is on probation (Cerebras 30-day/50-article window). Auto-publish skipped.';


--
-- Name: COLUMN pending_drafts.lint_result; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pending_drafts.lint_result IS 'Full LintResult JSON from src/lib/lint.ts including all gates and warnings.';


--
-- Name: COLUMN pending_drafts.discard_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.pending_drafts.discard_reason IS 'Free-text reason when status=rejected for non-editorial reasons (staleness, source removed, duplicate, etc.). 
NULL when rejection was an editorial quality decision.';


--
-- Name: pending_drafts_lint_results_backup_20260620; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pending_drafts_lint_results_backup_20260620 (
    id uuid,
    lint_results jsonb
);


ALTER TABLE public.pending_drafts_lint_results_backup_20260620 OWNER TO postgres;

--
-- Name: posted_lego_sets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posted_lego_sets (
    id bigint NOT NULL,
    set_id character varying(255) NOT NULL,
    title character varying(255),
    posted_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.posted_lego_sets OWNER TO postgres;

--
-- Name: posted_lego_sets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.posted_lego_sets ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.posted_lego_sets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: posted_sets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posted_sets (
    id bigint NOT NULL,
    set_num text NOT NULL,
    set_name text,
    posted_at timestamp with time zone DEFAULT now(),
    ig_feed_posted boolean DEFAULT false,
    ig_reels_posted boolean DEFAULT false,
    yt_shorts_posted boolean DEFAULT false
);


ALTER TABLE public.posted_sets OWNER TO postgres;

--
-- Name: posted_sets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.posted_sets ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.posted_sets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: price_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    set_id text NOT NULL,
    store_id text NOT NULL,
    price_inr numeric,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    in_stock boolean
);


ALTER TABLE public.price_history OWNER TO postgres;

--
-- Name: COLUMN price_history.in_stock; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.price_history.in_stock IS 'Stock state at this observation. NULL = not recorded (all rows before FP5.7, 2026-09-27).';


--
-- Name: price_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.price_snapshots (
    id bigint NOT NULL,
    set_num text NOT NULL,
    store text NOT NULL,
    price_inr integer NOT NULL,
    in_stock boolean NOT NULL,
    snapshot_date date NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.price_snapshots OWNER TO postgres;

--
-- Name: price_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.price_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.price_snapshots_id_seq OWNER TO postgres;

--
-- Name: price_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.price_snapshots_id_seq OWNED BY public.price_snapshots.id;


--
-- Name: prices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    set_id uuid,
    store_name text NOT NULL,
    store_url text NOT NULL,
    price_inr integer,
    availability text DEFAULT 'unknown'::text,
    buy_url text NOT NULL,
    scraped_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    CONSTRAINT prices_availability_check CHECK ((availability = ANY (ARRAY['in_stock'::text, 'out_of_stock'::text, 'unknown'::text])))
);


ALTER TABLE public.prices OWNER TO postgres;

--
-- Name: publish_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.publish_attempts (
    id bigint NOT NULL,
    pipeline text NOT NULL,
    row_id uuid,
    row_number integer,
    kind text NOT NULL,
    platform text,
    outcome text NOT NULL,
    detail text,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT publish_attempts_kind_check CHECK ((kind = ANY (ARRAY['publish'::text, 'retry'::text, 'missed_slot_alert'::text, 'error_alert'::text]))),
    CONSTRAINT publish_attempts_outcome_check CHECK ((outcome = ANY (ARRAY['posted'::text, 'partial'::text, 'failed'::text, 'blocked'::text, 'deferred'::text, 'alerted'::text]))),
    CONSTRAINT publish_attempts_pipeline_check CHECK ((pipeline = ANY (ARRAY['vidp4'::text, 'vidqp'::text]))),
    CONSTRAINT publish_attempts_platform_check CHECK (((platform IS NULL) OR (platform = ANY (ARRAY['ig'::text, 'yt'::text]))))
);


ALTER TABLE public.publish_attempts OWNER TO postgres;

--
-- Name: TABLE publish_attempts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.publish_attempts IS 'Append-only audit of video publish/retry outcomes and cadence alerts (issue #178). Read by the missed-slot watchdog. service_role only.';


--
-- Name: publish_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.publish_attempts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.publish_attempts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: quiet_panic_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quiet_panic_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    set_title text NOT NULL,
    set_number text,
    price_inr numeric,
    script text NOT NULL,
    video_path text NOT NULL,
    storage_url text,
    gate_results jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending_approval'::text NOT NULL,
    ig_media_id text,
    ig_permalink text,
    ig_raw_response jsonb,
    yt_video_id text,
    yt_url text,
    yt_raw_response jsonb,
    sequence_number integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    posted_at timestamp with time zone,
    rejection_reason text,
    reworked boolean DEFAULT false NOT NULL,
    reworked_from uuid,
    provider text,
    input_tokens integer,
    output_tokens integer,
    estimated_cost_usd numeric,
    title_number_mismatch boolean DEFAULT false,
    title_mismatch_detail text,
    needs_rerender boolean DEFAULT false,
    rerender_note text,
    mismatch_override boolean DEFAULT false,
    override_reason text,
    gate_override boolean DEFAULT false,
    gate_override_reason text,
    approved_at timestamp with time zone,
    ig_posted_at timestamp with time zone,
    yt_posted_at timestamp with time zone,
    CONSTRAINT quiet_panic_posts_status_check CHECK ((status = ANY (ARRAY['pending_approval'::text, 'approved'::text, 'posted_ig'::text, 'posted_yt'::text, 'posted_both'::text, 'discarded'::text, 'publish_blocked'::text, 'rejected'::text])))
);


ALTER TABLE public.quiet_panic_posts OWNER TO postgres;

--
-- Name: COLUMN quiet_panic_posts.provider; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.quiet_panic_posts.provider IS 'LLM provider that produced the script: gemini | groq | cerebras | null (legacy rows predating this column)';


--
-- Name: COLUMN quiet_panic_posts.input_tokens; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.quiet_panic_posts.input_tokens IS 'Prompt token count for the successful generation call (system + user prompt). Null if the provider API did not return usage data.';


--
-- Name: COLUMN quiet_panic_posts.output_tokens; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.quiet_panic_posts.output_tokens IS 'Completion token count for the successful generation call. Null if the provider API did not return usage data.';


--
-- Name: COLUMN quiet_panic_posts.estimated_cost_usd; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.quiet_panic_posts.estimated_cost_usd IS 'Estimated cost in USD for the successful generation call, computed from input/output tokens at the provider''s published rate. Free-tier providers (Groq, Cerebras free) record 0.';


--
-- Name: COLUMN quiet_panic_posts.approved_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.quiet_panic_posts.approved_at IS 'Set by trg_set_approved_at whenever status moves to approved (issue #178). NULL for rows approved before 2026-09-24 -- not back-filled.';


--
-- Name: COLUMN quiet_panic_posts.ig_posted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.quiet_panic_posts.ig_posted_at IS 'When the Instagram post went live (publish or retry). Issue #178.';


--
-- Name: COLUMN quiet_panic_posts.yt_posted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.quiet_panic_posts.yt_posted_at IS 'When the YouTube post went live (publish or retry). Issue #178.';


--
-- Name: raw_signals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.raw_signals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_name text NOT NULL,
    source_tier integer NOT NULL,
    source_type text NOT NULL,
    external_id text,
    url text NOT NULL,
    url_hash text NOT NULL,
    title text NOT NULL,
    title_hash text NOT NULL,
    body text,
    published_at timestamp with time zone,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    raw_payload jsonb,
    dedup_status text DEFAULT 'pending'::text NOT NULL,
    dedup_group_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT raw_signals_dedup_status_check CHECK ((dedup_status = ANY (ARRAY['pending'::text, 'unique'::text, 'duplicate'::text, 'cross_source_primary'::text, 'cross_source_secondary'::text]))),
    CONSTRAINT raw_signals_source_tier_check CHECK (((source_tier >= 1) AND (source_tier <= 5))),
    CONSTRAINT raw_signals_source_type_check CHECK ((source_type = ANY (ARRAY['rss'::text, 'api'::text, 'scrape'::text, 'reddit'::text, 'youtube'::text])))
);


ALTER TABLE public.raw_signals OWNER TO postgres;

--
-- Name: reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    set_id uuid,
    title text NOT NULL,
    slug text NOT NULL,
    content text NOT NULL,
    verdict text NOT NULL,
    rating integer,
    youtube_url text,
    published_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    hero_image text,
    excerpt text,
    seo_title text,
    seo_description text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_retailer text,
    source_price_inr integer,
    source_stock_status text,
    source_checked_at timestamp with time zone,
    verdict_disclaimer_variant text,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.reviews OWNER TO postgres;

--
-- Name: sets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    set_number text NOT NULL,
    name text NOT NULL,
    theme text DEFAULT ''::text NOT NULL,
    subtheme text,
    year integer,
    pieces integer,
    minifigs integer,
    image_url text,
    description text,
    age_range text,
    lego_mrp_inr integer,
    rebrickable_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    retirement_date date,
    is_retiring_soon boolean DEFAULT false NOT NULL,
    retired boolean DEFAULT false NOT NULL,
    mrp_verified boolean DEFAULT false NOT NULL,
    mrp_review_reason text,
    index_tier text DEFAULT 'tier2'::text NOT NULL,
    indexnow_submitted_at timestamp with time zone,
    is_gwp boolean DEFAULT false NOT NULL,
    gwp_parent_set_number text,
    noindex_override boolean DEFAULT false NOT NULL,
    CONSTRAINT sets_index_tier_check CHECK ((index_tier = ANY (ARRAY['tier1'::text, 'tier2'::text, 'tier3'::text])))
);


ALTER TABLE public.sets OWNER TO postgres;

--
-- Name: COLUMN sets.is_gwp; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sets.is_gwp IS 'True if this set was originally released as a Gift-with-Purchase (LEGO.com Insiders Days spend-threshold promo, or bundled with a specific set), not a normally purchasable retail set. Independent of whether a store currently sells it standalone -- see gwp_parent_set_number and the store_prices-first display rule (store_prices is always checked first; is_gwp only explains an absence of a price, it never suppresses a real one).';


--
-- Name: COLUMN sets.gwp_parent_set_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sets.gwp_parent_set_number IS 'For a GWP that requires purchasing one specific other set to receive it (not a general LEGO.com spend threshold with no single required item), that required parent set''s set_number. NULL for spend-threshold GWPs with no single required parent, and for any non-GWP set.';


--
-- Name: COLUMN sets.noindex_override; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sets.noindex_override IS 'Manually-applied noindex, independent of the trigger-maintained index_tier column -- see 20260829010000_tier2_stale_noindex_override.sql. Currently used for the "tier2, year<2020, zero price_history ever" cutoff (14,836 sets applied 2026-08-29). Point-in-time: not automatically cleared if a flagged set later gets its first real price.';


--
-- Name: store_prices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.store_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    set_id text NOT NULL,
    store_id text NOT NULL,
    price_inr numeric,
    in_stock boolean DEFAULT false NOT NULL,
    product_url text NOT NULL,
    scraped_at timestamp with time zone DEFAULT now() NOT NULL,
    compare_at_price_inr integer,
    CONSTRAINT store_prices_store_id_check CHECK ((store_id = ANY (ARRAY['toycra'::text, 'mybrickhouse'::text, 'jaiman'::text])))
);


ALTER TABLE public.store_prices OWNER TO postgres;

--
-- Name: COLUMN store_prices.compare_at_price_inr; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.store_prices.compare_at_price_inr IS 'Listing''s displayed MRP / strike-through (Shopify compare_at_price) for the chosen variant, rounded INR. NULL when the store sets none. Written by scripts/scrape-now.mjs; never copied to price_history.';


--
-- Name: set_price_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.set_price_summary WITH (security_invoker='true') AS
 WITH cur AS (
         SELECT store_prices.set_id,
            store_prices.store_id,
            store_prices.price_inr,
            store_prices.compare_at_price_inr,
            store_prices.in_stock,
            store_prices.scraped_at
           FROM public.store_prices
          WHERE ((store_prices.price_inr IS NOT NULL) AND (store_prices.scraped_at > (now() - '12:00:00'::interval)))
        ), mbh AS (
         SELECT cur.set_id,
                CASE
                    WHEN ((cur.compare_at_price_inr)::numeric > cur.price_inr) THEN (cur.compare_at_price_inr)::numeric
                    ELSE cur.price_inr
                END AS mrp
           FROM cur
          WHERE (cur.store_id = 'mybrickhouse'::text)
        ), toy AS (
         SELECT cur.set_id,
            cur.price_inr,
            cur.compare_at_price_inr AS ca
           FROM cur
          WHERE (cur.store_id = 'toycra'::text)
        ), live AS (
         SELECT cur.set_id,
            min(cur.price_inr) AS best_price_inr,
            count(DISTINCT cur.store_id) AS in_stock_store_count
           FROM cur
          WHERE cur.in_stock
          GROUP BY cur.set_id
        ), best_stores AS (
         SELECT c.set_id,
            array_agg(c.store_id ORDER BY c.store_id) AS best_store_ids,
            max(c.scraped_at) AS best_scraped_at
           FROM (cur c
             JOIN live l_1 ON (((l_1.set_id = c.set_id) AND c.in_stock AND (c.price_inr = l_1.best_price_inr))))
          GROUP BY c.set_id
        ), anchored AS (
         SELECT s.set_number AS set_id,
                CASE
                    WHEN (m.set_id IS NOT NULL) THEN m.mrp
                    WHEN (t.set_id IS NOT NULL) THEN
                    CASE
                        WHEN (((t.ca)::numeric > t.price_inr) AND s.mrp_verified AND (s.lego_mrp_inr IS NOT NULL) AND (t.ca > s.lego_mrp_inr)) THEN (s.lego_mrp_inr)::numeric
                        WHEN ((t.ca)::numeric > t.price_inr) THEN (t.ca)::numeric
                        ELSE t.price_inr
                    END
                    WHEN (s.mrp_verified AND (s.lego_mrp_inr IS NOT NULL)) THEN (s.lego_mrp_inr)::numeric
                    ELSE NULL::numeric
                END AS anchor_mrp_inr,
                CASE
                    WHEN (m.set_id IS NOT NULL) THEN 'mybrickhouse'::text
                    WHEN (t.set_id IS NOT NULL) THEN
                    CASE
                        WHEN (((t.ca)::numeric > t.price_inr) AND s.mrp_verified AND (s.lego_mrp_inr IS NOT NULL) AND (t.ca > s.lego_mrp_inr)) THEN 'catalogue'::text
                        ELSE 'toycra'::text
                    END
                    WHEN (s.mrp_verified AND (s.lego_mrp_inr IS NOT NULL)) THEN 'catalogue'::text
                    ELSE NULL::text
                END AS anchor_source
           FROM ((public.sets s
             LEFT JOIN mbh m ON ((m.set_id = s.set_number)))
             LEFT JOIN toy t ON ((t.set_id = s.set_number)))
        )
 SELECT a.set_id,
    a.anchor_mrp_inr,
    a.anchor_source,
    l.best_price_inr,
    b.best_store_ids,
    b.best_scraped_at,
    (COALESCE(l.in_stock_store_count, (0)::bigint))::integer AS in_stock_store_count,
        CASE
            WHEN ((a.anchor_mrp_inr > (0)::numeric) AND (l.best_price_inr IS NOT NULL)) THEN round((((1)::numeric - (l.best_price_inr / a.anchor_mrp_inr)) * (100)::numeric), 1)
            ELSE NULL::numeric
        END AS discount_pct,
        CASE
            WHEN ((a.anchor_mrp_inr > (0)::numeric) AND (l.best_price_inr <= (a.anchor_mrp_inr * 0.80))) THEN 'hot'::text
            WHEN ((a.anchor_mrp_inr > (0)::numeric) AND (l.best_price_inr <= (a.anchor_mrp_inr * 0.90))) THEN 'deal'::text
            ELSE NULL::text
        END AS deal_tier
   FROM ((anchored a
     LEFT JOIN live l ON ((l.set_id = a.set_id)))
     LEFT JOIN best_stores b ON ((b.set_id = a.set_id)))
  WHERE ((a.anchor_mrp_inr IS NOT NULL) OR (l.best_price_inr IS NOT NULL));


ALTER VIEW public.set_price_summary OWNER TO postgres;

--
-- Name: VIEW set_price_summary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.set_price_summary IS 'Locked pricing rules R2 (MRP anchor, ruling C + Toycra safeguard) and R3 (deal tiers) per set. Read by /deals, /, /sets/[slug], /lab/deals. See migration 20260926020000.';


--
-- Name: social_automation_heartbeat; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.social_automation_heartbeat (
    platform text NOT NULL,
    last_attempt_at timestamp with time zone,
    last_success_at timestamp with time zone,
    last_failure_at timestamp with time zone,
    last_error text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    consecutive_skip_days integer DEFAULT 0 NOT NULL,
    skip_reason text
);


ALTER TABLE public.social_automation_heartbeat OWNER TO postgres;

--
-- Name: v_published_articles_public; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_published_articles_public WITH (security_invoker='true') AS
 SELECT news_articles.id,
    news_articles.slug,
    news_articles.title,
    news_articles.excerpt AS lede,
    news_articles.published_at,
    NULL::timestamp with time zone AS updated_at,
    'news'::text AS route_type
   FROM public.news_articles
  WHERE (news_articles.published_at IS NOT NULL)
UNION ALL
 SELECT blog_posts.id,
    blog_posts.slug,
    blog_posts.title,
    blog_posts.excerpt AS lede,
    blog_posts.published_at,
    NULL::timestamp with time zone AS updated_at,
        CASE
            WHEN (blog_posts.category = 'Opinion'::text) THEN 'opinion'::text
            ELSE 'blog'::text
        END AS route_type
   FROM public.blog_posts
  WHERE (blog_posts.published_at IS NOT NULL);


ALTER VIEW public.v_published_articles_public OWNER TO postgres;

--
-- Name: v_scan_batch_health; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_scan_batch_health WITH (security_invoker='true') AS
 WITH total_articles AS (
         SELECT (((( SELECT count(*) AS count
                   FROM public.reviews) + ( SELECT count(*) AS count
                   FROM public.blog_posts)) + ( SELECT count(*) AS count
                   FROM public.news_articles)) + ( SELECT count(*) AS count
                   FROM public.guides)) AS n
        ), batches AS (
         SELECT content_quality_issues.checked_at,
            count(*) AS issue_rows,
            count(DISTINCT content_quality_issues.article_slug) AS distinct_articles_failed
           FROM public.content_quality_issues
          WHERE (content_quality_issues.check_name = 'page_load_error'::text)
          GROUP BY content_quality_issues.checked_at
        )
 SELECT b.checked_at,
    b.issue_rows,
    b.distinct_articles_failed,
    t.n AS total_articles_live,
    round(((100.0 * (b.distinct_articles_failed)::numeric) / (GREATEST(t.n, (1)::bigint))::numeric), 1) AS pct_articles_failed,
    (((b.distinct_articles_failed)::double precision / (GREATEST(t.n, (1)::bigint))::double precision) > (0.15)::double precision) AS systemic_failure_suspected
   FROM batches b,
    total_articles t
  ORDER BY b.checked_at DESC;


ALTER VIEW public.v_scan_batch_health OWNER TO postgres;

--
-- Name: video_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    set_title text NOT NULL,
    set_number text,
    store text NOT NULL,
    product_url text NOT NULL,
    price_inr numeric NOT NULL,
    script text NOT NULL,
    script_chars integer NOT NULL,
    gate_results jsonb NOT NULL,
    video_path text NOT NULL,
    status text DEFAULT 'rendered'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    posted_at timestamp with time zone,
    storage_url text,
    qc_frame_urls jsonb,
    ig_media_id text,
    ig_permalink text,
    ig_raw_response jsonb,
    yt_video_id text,
    yt_url text,
    yt_raw_response jsonb,
    story_number integer NOT NULL,
    piece_count_discrepancy jsonb,
    provider text,
    input_tokens integer,
    output_tokens integer,
    estimated_cost_usd numeric,
    title_number_mismatch boolean DEFAULT false,
    title_mismatch_detail text,
    needs_rerender boolean DEFAULT false,
    rerender_note text,
    mismatch_override boolean DEFAULT false,
    override_reason text,
    gate_override boolean DEFAULT false,
    gate_override_reason text,
    escalation_note jsonb,
    approved_at timestamp with time zone,
    ig_posted_at timestamp with time zone,
    yt_posted_at timestamp with time zone,
    CONSTRAINT video_posts_status_check CHECK ((status = ANY (ARRAY['rendered'::text, 'pending_approval'::text, 'approved'::text, 'posted_ig'::text, 'posted_yt'::text, 'posted_both'::text, 'discarded'::text, 'publish_blocked'::text])))
);


ALTER TABLE public.video_posts OWNER TO postgres;

--
-- Name: COLUMN video_posts.provider; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.video_posts.provider IS 'LLM provider that produced the script: gemini | groq | cerebras | null (legacy rows predating this column)';


--
-- Name: COLUMN video_posts.input_tokens; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.video_posts.input_tokens IS 'Prompt token count for the successful generation call (system + user prompt). Null if the provider API did not return usage data.';


--
-- Name: COLUMN video_posts.output_tokens; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.video_posts.output_tokens IS 'Completion token count for the successful generation call. Null if the provider API did not return usage data.';


--
-- Name: COLUMN video_posts.estimated_cost_usd; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.video_posts.estimated_cost_usd IS 'Estimated cost in USD for the successful generation call, computed from input/output tokens at the provider''s published rate. Free-tier providers (Groq, Cerebras free) record 0.';


--
-- Name: COLUMN video_posts.escalation_note; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.video_posts.escalation_note IS 'Gate Remediation Architecture (2026-08-29): structured, pre-diagnosed note for a reviewer -- null for a clean story (every gate passed, or a failure was fully auto-remediated); populated only when an unresolved gate failure reaches pending_approval after remediation was attempted. Shape: {gates: [{gate, what_it_caught, technical_reason}], remediation_attempted, decision_needed}. See engine.py build_escalation_note().';


--
-- Name: COLUMN video_posts.approved_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.video_posts.approved_at IS 'Set by trg_set_approved_at whenever status moves to approved (issue #178). NULL for rows approved before 2026-09-24 -- not back-filled.';


--
-- Name: COLUMN video_posts.ig_posted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.video_posts.ig_posted_at IS 'When the Instagram post went live (publish or retry). Issue #178.';


--
-- Name: COLUMN video_posts.yt_posted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.video_posts.yt_posted_at IS 'When the YouTube post went live (publish or retry). Issue #178.';


--
-- Name: video_posts_story_number_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.video_posts_story_number_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.video_posts_story_number_seq OWNER TO postgres;

--
-- Name: video_posts_story_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.video_posts_story_number_seq OWNED BY public.video_posts.story_number;


--
-- Name: price_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_snapshots ALTER COLUMN id SET DEFAULT nextval('public.price_snapshots_id_seq'::regclass);


--
-- Name: content_performance content_performance_pkey; Type: CONSTRAINT; Schema: growth; Owner: postgres
--

ALTER TABLE ONLY growth.content_performance
    ADD CONSTRAINT content_performance_pkey PRIMARY KEY (id);


--
-- Name: forecasts forecasts_pkey; Type: CONSTRAINT; Schema: growth; Owner: postgres
--

ALTER TABLE ONLY growth.forecasts
    ADD CONSTRAINT forecasts_pkey PRIMARY KEY (id);


--
-- Name: ingestion_runs ingestion_runs_pkey; Type: CONSTRAINT; Schema: growth; Owner: postgres
--

ALTER TABLE ONLY growth.ingestion_runs
    ADD CONSTRAINT ingestion_runs_pkey PRIMARY KEY (id);


--
-- Name: insights insights_pkey; Type: CONSTRAINT; Schema: growth; Owner: postgres
--

ALTER TABLE ONLY growth.insights
    ADD CONSTRAINT insights_pkey PRIMARY KEY (id);


--
-- Name: newsletter_drafts newsletter_drafts_pkey; Type: CONSTRAINT; Schema: growth; Owner: postgres
--

ALTER TABLE ONLY growth.newsletter_drafts
    ADD CONSTRAINT newsletter_drafts_pkey PRIMARY KEY (id);


--
-- Name: newsletter_events newsletter_events_pkey; Type: CONSTRAINT; Schema: growth; Owner: postgres
--

ALTER TABLE ONLY growth.newsletter_events
    ADD CONSTRAINT newsletter_events_pkey PRIMARY KEY (id);


--
-- Name: newsletter_events newsletter_events_svix_id_key; Type: CONSTRAINT; Schema: growth; Owner: postgres
--

ALTER TABLE ONLY growth.newsletter_events
    ADD CONSTRAINT newsletter_events_svix_id_key UNIQUE (svix_id);


--
-- Name: platform_metrics_daily platform_metrics_daily_pkey; Type: CONSTRAINT; Schema: growth; Owner: postgres
--

ALTER TABLE ONLY growth.platform_metrics_daily
    ADD CONSTRAINT platform_metrics_daily_pkey PRIMARY KEY (id);


--
-- Name: platform_metrics_daily platform_metrics_daily_platform_metric_date_key; Type: CONSTRAINT; Schema: growth; Owner: postgres
--

ALTER TABLE ONLY growth.platform_metrics_daily
    ADD CONSTRAINT platform_metrics_daily_platform_metric_date_key UNIQUE (platform, metric_date);


--
-- Name: reddit_activity reddit_activity_pkey; Type: CONSTRAINT; Schema: growth; Owner: postgres
--

ALTER TABLE ONLY growth.reddit_activity
    ADD CONSTRAINT reddit_activity_pkey PRIMARY KEY (id);


--
-- Name: subscribers subscribers_email_key; Type: CONSTRAINT; Schema: growth; Owner: postgres
--

ALTER TABLE ONLY growth.subscribers
    ADD CONSTRAINT subscribers_email_key UNIQUE (email);


--
-- Name: subscribers subscribers_pkey; Type: CONSTRAINT; Schema: growth; Owner: postgres
--

ALTER TABLE ONLY growth.subscribers
    ADD CONSTRAINT subscribers_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- Name: capacity_usage_snapshots capacity_usage_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capacity_usage_snapshots
    ADD CONSTRAINT capacity_usage_snapshots_pkey PRIMARY KEY (taken_at);


--
-- Name: catalog_coverage_trend catalog_coverage_trend_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalog_coverage_trend
    ADD CONSTRAINT catalog_coverage_trend_pkey PRIMARY KEY (id);


--
-- Name: cmf_figures cmf_figures_figure_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cmf_figures
    ADD CONSTRAINT cmf_figures_figure_number_key UNIQUE (figure_number);


--
-- Name: cmf_figures cmf_figures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cmf_figures
    ADD CONSTRAINT cmf_figures_pkey PRIMARY KEY (id);


--
-- Name: community_spotlights community_spotlights_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_spotlights
    ADD CONSTRAINT community_spotlights_pkey PRIMARY KEY (id);


--
-- Name: community_spotlights community_spotlights_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_spotlights
    ADD CONSTRAINT community_spotlights_slug_key UNIQUE (slug);


--
-- Name: content_fix_log content_fix_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_fix_log
    ADD CONSTRAINT content_fix_log_pkey PRIMARY KEY (id);


--
-- Name: content_image_registry content_image_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_image_registry
    ADD CONSTRAINT content_image_registry_pkey PRIMARY KEY (id);


--
-- Name: content_quality_issues_archive content_quality_issues_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_quality_issues_archive
    ADD CONSTRAINT content_quality_issues_archive_pkey PRIMARY KEY (id);


--
-- Name: content_quality_issues content_quality_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_quality_issues
    ADD CONSTRAINT content_quality_issues_pkey PRIMARY KEY (id);


--
-- Name: content_rejection_reminders content_rejection_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_rejection_reminders
    ADD CONSTRAINT content_rejection_reminders_pkey PRIMARY KEY (id);


--
-- Name: content_rejections content_rejections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_rejections
    ADD CONSTRAINT content_rejections_pkey PRIMARY KEY (id);


--
-- Name: featured_videos featured_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.featured_videos
    ADD CONSTRAINT featured_videos_pkey PRIMARY KEY (id);


--
-- Name: generator_runs generator_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.generator_runs
    ADD CONSTRAINT generator_runs_pkey PRIMARY KEY (id);


--
-- Name: guides guides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_pkey PRIMARY KEY (id);


--
-- Name: guides guides_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_slug_key UNIQUE (slug);


--
-- Name: image_repair_queue image_repair_queue_article_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.image_repair_queue
    ADD CONSTRAINT image_repair_queue_article_slug_key UNIQUE (article_slug);


--
-- Name: image_repair_queue image_repair_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.image_repair_queue
    ADD CONSTRAINT image_repair_queue_pkey PRIMARY KEY (id);


--
-- Name: news_articles news_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_articles
    ADD CONSTRAINT news_articles_pkey PRIMARY KEY (id);


--
-- Name: news_articles news_articles_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_articles
    ADD CONSTRAINT news_articles_slug_key UNIQUE (slug);


--
-- Name: newsletter_subscribers newsletter_subscribers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_email_key UNIQUE (email);


--
-- Name: newsletter_subscribers newsletter_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (id);


--
-- Name: opinion_cadence_log opinion_cadence_log_cycle_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opinion_cadence_log
    ADD CONSTRAINT opinion_cadence_log_cycle_date_key UNIQUE (cycle_date);


--
-- Name: opinion_cadence_log opinion_cadence_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opinion_cadence_log
    ADD CONSTRAINT opinion_cadence_log_pkey PRIMARY KEY (id);


--
-- Name: pending_drafts pending_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_drafts
    ADD CONSTRAINT pending_drafts_pkey PRIMARY KEY (id);


--
-- Name: posted_lego_sets posted_lego_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posted_lego_sets
    ADD CONSTRAINT posted_lego_sets_pkey PRIMARY KEY (id);


--
-- Name: posted_lego_sets posted_lego_sets_set_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posted_lego_sets
    ADD CONSTRAINT posted_lego_sets_set_id_key UNIQUE (set_id);


--
-- Name: posted_sets posted_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posted_sets
    ADD CONSTRAINT posted_sets_pkey PRIMARY KEY (id);


--
-- Name: posted_sets posted_sets_set_num_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posted_sets
    ADD CONSTRAINT posted_sets_set_num_key UNIQUE (set_num);


--
-- Name: price_history price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);


--
-- Name: price_snapshots price_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_snapshots
    ADD CONSTRAINT price_snapshots_pkey PRIMARY KEY (id);


--
-- Name: price_snapshots price_snapshots_set_num_store_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_snapshots
    ADD CONSTRAINT price_snapshots_set_num_store_snapshot_date_key UNIQUE (set_num, store, snapshot_date);


--
-- Name: prices prices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prices
    ADD CONSTRAINT prices_pkey PRIMARY KEY (id);


--
-- Name: prices prices_set_id_store_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prices
    ADD CONSTRAINT prices_set_id_store_name_key UNIQUE (set_id, store_name);


--
-- Name: publish_attempts publish_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.publish_attempts
    ADD CONSTRAINT publish_attempts_pkey PRIMARY KEY (id);


--
-- Name: quiet_panic_posts quiet_panic_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quiet_panic_posts
    ADD CONSTRAINT quiet_panic_posts_pkey PRIMARY KEY (id);


--
-- Name: raw_signals raw_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.raw_signals
    ADD CONSTRAINT raw_signals_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_slug_key UNIQUE (slug);


--
-- Name: reviews reviews_verdict_no_import_check; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_verdict_no_import_check CHECK (((source_retailer IS NULL) OR (verdict = ANY (ARRAY['BUY NOW'::text, 'WAIT'::text, 'AVOID'::text])))) NOT VALID;


--
-- Name: sets sets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sets
    ADD CONSTRAINT sets_pkey PRIMARY KEY (id);


--
-- Name: sets sets_set_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sets
    ADD CONSTRAINT sets_set_number_key UNIQUE (set_number);


--
-- Name: social_automation_heartbeat social_automation_heartbeat_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_automation_heartbeat
    ADD CONSTRAINT social_automation_heartbeat_pkey PRIMARY KEY (platform);


--
-- Name: store_prices store_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_prices
    ADD CONSTRAINT store_prices_pkey PRIMARY KEY (id);


--
-- Name: store_prices store_prices_set_id_store_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_prices
    ADD CONSTRAINT store_prices_set_id_store_id_key UNIQUE (set_id, store_id);


--
-- Name: video_posts video_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_posts
    ADD CONSTRAINT video_posts_pkey PRIMARY KEY (id);


--
-- Name: video_posts video_posts_story_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_posts
    ADD CONSTRAINT video_posts_story_number_key UNIQUE (story_number);


--
-- Name: idx_newsletter_drafts_broadcast_id; Type: INDEX; Schema: growth; Owner: postgres
--

CREATE INDEX idx_newsletter_drafts_broadcast_id ON growth.newsletter_drafts USING btree (resend_broadcast_id);


--
-- Name: idx_newsletter_events_draft; Type: INDEX; Schema: growth; Owner: postgres
--

CREATE INDEX idx_newsletter_events_draft ON growth.newsletter_events USING btree (draft_id);


--
-- Name: idx_newsletter_events_recipient; Type: INDEX; Schema: growth; Owner: postgres
--

CREATE INDEX idx_newsletter_events_recipient ON growth.newsletter_events USING btree (recipient_email);


--
-- Name: ingestion_runs_platform_date_idx; Type: INDEX; Schema: growth; Owner: postgres
--

CREATE INDEX ingestion_runs_platform_date_idx ON growth.ingestion_runs USING btree (platform, target_date, finished_at DESC);


--
-- Name: cmf_figures_series_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cmf_figures_series_idx ON public.cmf_figures USING btree (series_set_number);


--
-- Name: cmf_figures_year_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cmf_figures_year_idx ON public.cmf_figures USING btree (year);


--
-- Name: content_quality_issues_archive_article_slug_check_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX content_quality_issues_archive_article_slug_check_name_idx ON public.content_quality_issues_archive USING btree (article_slug, check_name) WHERE (resolved = false);


--
-- Name: content_quality_issues_archive_article_slug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_quality_issues_archive_article_slug_idx ON public.content_quality_issues_archive USING btree (article_slug);


--
-- Name: content_quality_issues_archive_checked_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_quality_issues_archive_checked_at_idx ON public.content_quality_issues_archive USING btree (checked_at);


--
-- Name: content_quality_issues_archive_first_seen_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_quality_issues_archive_first_seen_at_idx ON public.content_quality_issues_archive USING btree (first_seen_at);


--
-- Name: content_quality_issues_archive_severity_resolved_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_quality_issues_archive_severity_resolved_idx ON public.content_quality_issues_archive USING btree (severity, resolved);


--
-- Name: content_quality_issues_article_slug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_quality_issues_article_slug_idx ON public.content_quality_issues USING btree (article_slug);


--
-- Name: content_quality_issues_checked_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_quality_issues_checked_at_idx ON public.content_quality_issues USING btree (checked_at);


--
-- Name: content_quality_issues_first_seen_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_quality_issues_first_seen_at_idx ON public.content_quality_issues USING btree (first_seen_at);


--
-- Name: content_quality_issues_open_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX content_quality_issues_open_unique ON public.content_quality_issues USING btree (article_slug, check_name) WHERE (resolved = false);


--
-- Name: content_quality_issues_severity_resolved_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_quality_issues_severity_resolved_idx ON public.content_quality_issues USING btree (severity, resolved);


--
-- Name: idx_blog_posts_published; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blog_posts_published ON public.blog_posts USING btree (published_at DESC);


--
-- Name: idx_blog_posts_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blog_posts_slug ON public.blog_posts USING btree (slug);


--
-- Name: idx_catalog_coverage_trend_logged_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_catalog_coverage_trend_logged_at ON public.catalog_coverage_trend USING btree (logged_at);


--
-- Name: idx_cfl_article_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cfl_article_slug ON public.content_fix_log USING btree (article_slug);


--
-- Name: idx_cfl_fixed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cfl_fixed_at ON public.content_fix_log USING btree (fixed_at);


--
-- Name: idx_cir_checked_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cir_checked_at ON public.content_image_registry USING btree (checked_at);


--
-- Name: idx_cir_image_url; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cir_image_url ON public.content_image_registry USING btree (image_url);


--
-- Name: idx_cir_is_duplicate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cir_is_duplicate ON public.content_image_registry USING btree (is_duplicate);


--
-- Name: idx_generator_runs_started; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_generator_runs_started ON public.generator_runs USING btree (started_at DESC);


--
-- Name: idx_news_articles_published; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_news_articles_published ON public.news_articles USING btree (published_at DESC);


--
-- Name: idx_news_articles_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_news_articles_slug ON public.news_articles USING btree (slug);


--
-- Name: idx_pending_drafts_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pending_drafts_created_at ON public.pending_drafts USING btree (created_at DESC);


--
-- Name: idx_pending_drafts_iteration_label; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pending_drafts_iteration_label ON public.pending_drafts USING btree (iteration_label);


--
-- Name: idx_pending_drafts_manual_review; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pending_drafts_manual_review ON public.pending_drafts USING btree (requires_manual_approval) WHERE (requires_manual_approval = true);


--
-- Name: idx_pending_drafts_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pending_drafts_provider ON public.pending_drafts USING btree (provider);


--
-- Name: idx_pending_drafts_source_url; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pending_drafts_source_url ON public.pending_drafts USING btree (source_url);


--
-- Name: idx_pending_drafts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pending_drafts_status ON public.pending_drafts USING btree (status);


--
-- Name: idx_posted_sets_set_num; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_posted_sets_set_num ON public.posted_sets USING btree (set_num);


--
-- Name: idx_price_history_recorded; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_price_history_recorded ON public.price_history USING btree (recorded_at DESC);


--
-- Name: idx_price_history_set_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_price_history_set_id ON public.price_history USING btree (set_id);


--
-- Name: idx_price_history_store_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_price_history_store_id ON public.price_history USING btree (store_id);


--
-- Name: idx_price_snapshots_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_price_snapshots_date ON public.price_snapshots USING btree (snapshot_date DESC);


--
-- Name: idx_price_snapshots_set_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_price_snapshots_set_date ON public.price_snapshots USING btree (set_num, snapshot_date DESC);


--
-- Name: idx_prices_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prices_is_active ON public.prices USING btree (is_active);


--
-- Name: idx_prices_scraped_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prices_scraped_at ON public.prices USING btree (scraped_at DESC);


--
-- Name: idx_prices_set_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prices_set_id ON public.prices USING btree (set_id);


--
-- Name: idx_prices_store_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prices_store_name ON public.prices USING btree (store_name);


--
-- Name: idx_quiet_panic_posts_rework_queue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quiet_panic_posts_rework_queue ON public.quiet_panic_posts USING btree (status, reworked) WHERE (status = 'rejected'::text);


--
-- Name: idx_quiet_panic_posts_reworked_from; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quiet_panic_posts_reworked_from ON public.quiet_panic_posts USING btree (reworked_from) WHERE (reworked_from IS NOT NULL);


--
-- Name: idx_quiet_panic_posts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quiet_panic_posts_status ON public.quiet_panic_posts USING btree (status);


--
-- Name: idx_reviews_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_slug ON public.reviews USING btree (slug);


--
-- Name: idx_sets_index_tier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sets_index_tier ON public.sets USING btree (index_tier);


--
-- Name: idx_sets_mrp_verified; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sets_mrp_verified ON public.sets USING btree (mrp_verified);


--
-- Name: idx_sets_noindex_override; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sets_noindex_override ON public.sets USING btree (noindex_override) WHERE noindex_override;


--
-- Name: idx_sets_set_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sets_set_number ON public.sets USING btree (set_number);


--
-- Name: idx_sets_theme; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sets_theme ON public.sets USING btree (theme);


--
-- Name: idx_sets_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sets_year ON public.sets USING btree (year DESC);


--
-- Name: idx_store_prices_scraped; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_store_prices_scraped ON public.store_prices USING btree (scraped_at DESC);


--
-- Name: idx_store_prices_set_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_store_prices_set_id ON public.store_prices USING btree (set_id);


--
-- Name: idx_store_prices_store_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_store_prices_store_id ON public.store_prices USING btree (store_id);


--
-- Name: publish_attempts_pipeline_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX publish_attempts_pipeline_time_idx ON public.publish_attempts USING btree (pipeline, attempted_at DESC);


--
-- Name: raw_signals_dedup_group_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX raw_signals_dedup_group_idx ON public.raw_signals USING btree (dedup_group_id) WHERE (dedup_group_id IS NOT NULL);


--
-- Name: raw_signals_dedup_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX raw_signals_dedup_status_idx ON public.raw_signals USING btree (dedup_status);


--
-- Name: raw_signals_fetched_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX raw_signals_fetched_at_idx ON public.raw_signals USING btree (fetched_at DESC);


--
-- Name: raw_signals_title_hash_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX raw_signals_title_hash_idx ON public.raw_signals USING btree (title_hash);


--
-- Name: raw_signals_url_hash_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX raw_signals_url_hash_idx ON public.raw_signals USING btree (url_hash);


--
-- Name: pending_drafts pending_drafts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER pending_drafts_updated_at BEFORE UPDATE ON public.pending_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: quiet_panic_posts quiet_panic_posts_sequence_number_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER quiet_panic_posts_sequence_number_trigger BEFORE INSERT ON public.quiet_panic_posts FOR EACH ROW EXECUTE FUNCTION public.assign_quiet_panic_sequence_number();


--
-- Name: reviews reviews_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: social_automation_heartbeat set_social_automation_heartbeat_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_social_automation_heartbeat_updated_at BEFORE UPDATE ON public.social_automation_heartbeat FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: sets sets_sync_index_tier_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER sets_sync_index_tier_trigger AFTER INSERT OR UPDATE OF name, theme, year ON public.sets FOR EACH ROW EXECUTE FUNCTION public.trg_sync_index_tier_on_sets();


--
-- Name: sets sets_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER sets_updated_at BEFORE UPDATE ON public.sets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: store_prices store_prices_sync_index_tier_delete_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER store_prices_sync_index_tier_delete_trigger AFTER DELETE ON public.store_prices FOR EACH ROW EXECUTE FUNCTION public.trg_sync_index_tier_on_store_prices_delete();


--
-- Name: store_prices store_prices_sync_index_tier_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER store_prices_sync_index_tier_trigger AFTER INSERT OR UPDATE OF price_inr ON public.store_prices FOR EACH ROW EXECUTE FUNCTION public.trg_sync_index_tier_on_store_prices();


--
-- Name: store_prices trg_price_history_on_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_price_history_on_change AFTER INSERT OR UPDATE OF price_inr, in_stock ON public.store_prices FOR EACH ROW EXECUTE FUNCTION public.price_history_on_change();


--
-- Name: quiet_panic_posts trg_qp_posts_title_consistency; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_qp_posts_title_consistency BEFORE INSERT OR UPDATE ON public.quiet_panic_posts FOR EACH ROW EXECUTE FUNCTION public.check_qp_posts_title_consistency();


--
-- Name: quiet_panic_posts trg_set_approved_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_set_approved_at BEFORE INSERT OR UPDATE OF status ON public.quiet_panic_posts FOR EACH ROW EXECUTE FUNCTION public.set_approved_at();


--
-- Name: video_posts trg_set_approved_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_set_approved_at BEFORE INSERT OR UPDATE OF status ON public.video_posts FOR EACH ROW EXECUTE FUNCTION public.set_approved_at();


--
-- Name: video_posts trg_video_posts_title_consistency; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_video_posts_title_consistency BEFORE INSERT OR UPDATE ON public.video_posts FOR EACH ROW EXECUTE FUNCTION public.check_video_posts_title_consistency();


--
-- Name: video_posts video_posts_clear_priority_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER video_posts_clear_priority_trigger AFTER INSERT ON public.video_posts FOR EACH ROW EXECUTE FUNCTION public.clear_regeneration_priority_on_requeue();


--
-- Name: video_posts video_posts_story_number_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER video_posts_story_number_trigger BEFORE INSERT ON public.video_posts FOR EACH ROW EXECUTE FUNCTION public.assign_story_number();


--
-- Name: newsletter_events newsletter_events_draft_id_fkey; Type: FK CONSTRAINT; Schema: growth; Owner: postgres
--

ALTER TABLE ONLY growth.newsletter_events
    ADD CONSTRAINT newsletter_events_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES growth.newsletter_drafts(id);


--
-- Name: content_fix_log content_fix_log_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_fix_log
    ADD CONSTRAINT content_fix_log_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.content_quality_issues(id);


--
-- Name: content_rejections content_rejections_video_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_rejections
    ADD CONSTRAINT content_rejections_video_post_id_fkey FOREIGN KEY (video_post_id) REFERENCES public.video_posts(id);


--
-- Name: prices prices_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prices
    ADD CONSTRAINT prices_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.sets(id) ON DELETE CASCADE;


--
-- Name: quiet_panic_posts quiet_panic_posts_reworked_from_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quiet_panic_posts
    ADD CONSTRAINT quiet_panic_posts_reworked_from_fkey FOREIGN KEY (reworked_from) REFERENCES public.quiet_panic_posts(id);


--
-- Name: reviews reviews_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.sets(id) ON DELETE SET NULL;


--
-- Name: sets sets_gwp_parent_set_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sets
    ADD CONSTRAINT sets_gwp_parent_set_number_fkey FOREIGN KEY (gwp_parent_set_number) REFERENCES public.sets(set_number);


--
-- Name: content_performance; Type: ROW SECURITY; Schema: growth; Owner: postgres
--

ALTER TABLE growth.content_performance ENABLE ROW LEVEL SECURITY;

--
-- Name: forecasts; Type: ROW SECURITY; Schema: growth; Owner: postgres
--

ALTER TABLE growth.forecasts ENABLE ROW LEVEL SECURITY;

--
-- Name: forecasts growth_dashboard_select; Type: POLICY; Schema: growth; Owner: postgres
--

CREATE POLICY growth_dashboard_select ON growth.forecasts FOR SELECT TO growth_dashboard USING (true);


--
-- Name: newsletter_drafts growth_dashboard_select_drafts; Type: POLICY; Schema: growth; Owner: postgres
--

CREATE POLICY growth_dashboard_select_drafts ON growth.newsletter_drafts FOR SELECT TO growth_dashboard USING (true);


--
-- Name: newsletter_events growth_dashboard_select_events; Type: POLICY; Schema: growth; Owner: postgres
--

CREATE POLICY growth_dashboard_select_events ON growth.newsletter_events FOR SELECT TO growth_dashboard USING (true);


--
-- Name: newsletter_drafts growth_dashboard_update_drafts_status; Type: POLICY; Schema: growth; Owner: postgres
--

CREATE POLICY growth_dashboard_update_drafts_status ON growth.newsletter_drafts FOR UPDATE TO growth_dashboard USING ((status = 'pending_approval'::text)) WITH CHECK ((status = ANY (ARRAY['approved'::text, 'dismissed'::text])));


--
-- Name: forecasts growth_dashboard_update_status; Type: POLICY; Schema: growth; Owner: postgres
--

CREATE POLICY growth_dashboard_update_status ON growth.forecasts FOR UPDATE TO growth_dashboard USING ((status = 'pending_approval'::text)) WITH CHECK ((status = ANY (ARRAY['approved'::text, 'dismissed'::text])));


--
-- Name: subscribers growth_subscriber_sync_insert; Type: POLICY; Schema: growth; Owner: postgres
--

CREATE POLICY growth_subscriber_sync_insert ON growth.subscribers FOR INSERT TO growth_subscriber_sync WITH CHECK (true);


--
-- Name: subscribers growth_subscriber_sync_select; Type: POLICY; Schema: growth; Owner: postgres
--

CREATE POLICY growth_subscriber_sync_select ON growth.subscribers FOR SELECT TO growth_subscriber_sync USING (true);


--
-- Name: subscribers growth_subscriber_sync_update; Type: POLICY; Schema: growth; Owner: postgres
--

CREATE POLICY growth_subscriber_sync_update ON growth.subscribers FOR UPDATE TO growth_subscriber_sync USING (true) WITH CHECK (true);


--
-- Name: newsletter_events growth_webhook_insert; Type: POLICY; Schema: growth; Owner: postgres
--

CREATE POLICY growth_webhook_insert ON growth.newsletter_events FOR INSERT TO growth_webhook WITH CHECK (true);


--
-- Name: newsletter_drafts growth_webhook_select_drafts; Type: POLICY; Schema: growth; Owner: postgres
--

CREATE POLICY growth_webhook_select_drafts ON growth.newsletter_drafts FOR SELECT TO growth_webhook USING (true);


--
-- Name: newsletter_events growth_webhook_select_events; Type: POLICY; Schema: growth; Owner: postgres
--

CREATE POLICY growth_webhook_select_events ON growth.newsletter_events FOR SELECT TO growth_webhook USING (true);


--
-- Name: ingestion_runs; Type: ROW SECURITY; Schema: growth; Owner: postgres
--

ALTER TABLE growth.ingestion_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: insights; Type: ROW SECURITY; Schema: growth; Owner: postgres
--

ALTER TABLE growth.insights ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_drafts; Type: ROW SECURITY; Schema: growth; Owner: postgres
--

ALTER TABLE growth.newsletter_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_events; Type: ROW SECURITY; Schema: growth; Owner: postgres
--

ALTER TABLE growth.newsletter_events ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_metrics_daily; Type: ROW SECURITY; Schema: growth; Owner: postgres
--

ALTER TABLE growth.platform_metrics_daily ENABLE ROW LEVEL SECURITY;

--
-- Name: reddit_activity; Type: ROW SECURITY; Schema: growth; Owner: postgres
--

ALTER TABLE growth.reddit_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: subscribers; Type: ROW SECURITY; Schema: growth; Owner: postgres
--

ALTER TABLE growth.subscribers ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_subscribers Public insert newsletter; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public insert newsletter" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);


--
-- Name: blog_posts Public read blog_posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read blog_posts" ON public.blog_posts FOR SELECT TO anon USING (true);


--
-- Name: cmf_figures Public read cmf_figures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read cmf_figures" ON public.cmf_figures FOR SELECT TO anon USING (true);


--
-- Name: featured_videos Public read featured_videos; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read featured_videos" ON public.featured_videos FOR SELECT TO anon USING (true);


--
-- Name: guides Public read guides; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read guides" ON public.guides FOR SELECT TO anon USING (true);


--
-- Name: news_articles Public read news_articles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read news_articles" ON public.news_articles FOR SELECT TO anon USING (true);


--
-- Name: price_history Public read price_history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read price_history" ON public.price_history FOR SELECT TO anon USING (true);


--
-- Name: price_snapshots Public read price_snapshots; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read price_snapshots" ON public.price_snapshots FOR SELECT TO anon USING (true);


--
-- Name: prices Public read prices; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read prices" ON public.prices FOR SELECT TO anon USING (true);


--
-- Name: reviews Public read reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read reviews" ON public.reviews FOR SELECT TO anon USING (true);


--
-- Name: sets Public read sets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read sets" ON public.sets FOR SELECT TO anon USING (true);


--
-- Name: store_prices Public read store_prices; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read store_prices" ON public.store_prices FOR SELECT TO anon USING (true);


--
-- Name: price_history allow_public_read_price_history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_public_read_price_history ON public.price_history FOR SELECT USING (true);


--
-- Name: store_prices allow_public_read_store_prices; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_public_read_store_prices ON public.store_prices FOR SELECT USING (true);


--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: capacity_usage_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.capacity_usage_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: catalog_coverage_trend; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.catalog_coverage_trend ENABLE ROW LEVEL SECURITY;

--
-- Name: cmf_figures; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cmf_figures ENABLE ROW LEVEL SECURITY;

--
-- Name: cmf_figures cmf_figures_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cmf_figures_public_read ON public.cmf_figures FOR SELECT USING (true);


--
-- Name: community_spotlights; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.community_spotlights ENABLE ROW LEVEL SECURITY;

--
-- Name: content_fix_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.content_fix_log ENABLE ROW LEVEL SECURITY;

--
-- Name: content_image_registry; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.content_image_registry ENABLE ROW LEVEL SECURITY;

--
-- Name: content_quality_issues; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.content_quality_issues ENABLE ROW LEVEL SECURITY;

--
-- Name: content_quality_issues_archive; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.content_quality_issues_archive ENABLE ROW LEVEL SECURITY;

--
-- Name: content_rejection_reminders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.content_rejection_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: content_rejections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.content_rejections ENABLE ROW LEVEL SECURITY;

--
-- Name: featured_videos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.featured_videos ENABLE ROW LEVEL SECURITY;

--
-- Name: generator_runs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.generator_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_subscribers growth_subscriber_sync_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY growth_subscriber_sync_select ON public.newsletter_subscribers FOR SELECT TO growth_subscriber_sync USING (true);


--
-- Name: guides; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;

--
-- Name: image_repair_queue; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.image_repair_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: news_articles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_subscribers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

--
-- Name: opinion_cadence_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.opinion_cadence_log ENABLE ROW LEVEL SECURITY;

--
-- Name: pending_drafts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pending_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: pending_drafts_lint_results_backup_20260620; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pending_drafts_lint_results_backup_20260620 ENABLE ROW LEVEL SECURITY;

--
-- Name: posted_lego_sets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.posted_lego_sets ENABLE ROW LEVEL SECURITY;

--
-- Name: posted_sets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.posted_sets ENABLE ROW LEVEL SECURITY;

--
-- Name: price_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

--
-- Name: price_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: price_snapshots price_snapshots_anon_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY price_snapshots_anon_select ON public.price_snapshots FOR SELECT TO anon USING (true);


--
-- Name: prices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;

--
-- Name: guides public can read guides; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "public can read guides" ON public.guides FOR SELECT USING (true);


--
-- Name: community_spotlights public can read published spotlights; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "public can read published spotlights" ON public.community_spotlights FOR SELECT USING ((published = true));


--
-- Name: reviews public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "public read" ON public.reviews FOR SELECT TO anon USING (true);


--
-- Name: publish_attempts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.publish_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: quiet_panic_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.quiet_panic_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: raw_signals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.raw_signals ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: catalog_coverage_trend service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service role full access" ON public.catalog_coverage_trend USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: content_fix_log service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service role full access" ON public.content_fix_log USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: content_image_registry service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service role full access" ON public.content_image_registry USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: content_quality_issues service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service role full access" ON public.content_quality_issues USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: sets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;

--
-- Name: social_automation_heartbeat; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.social_automation_heartbeat ENABLE ROW LEVEL SECURITY;

--
-- Name: store_prices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.store_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: video_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.video_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA growth; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA growth TO growth_service;
GRANT USAGE ON SCHEMA growth TO growth_dashboard;
GRANT USAGE ON SCHEMA growth TO growth_subscriber_sync;
GRANT USAGE ON SCHEMA growth TO growth_webhook;
GRANT USAGE ON SCHEMA growth TO service_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO growth_subscriber_sync;
GRANT USAGE ON SCHEMA public TO growth_service;


--
-- Name: FUNCTION assign_quiet_panic_sequence_number(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.assign_quiet_panic_sequence_number() TO anon;
GRANT ALL ON FUNCTION public.assign_quiet_panic_sequence_number() TO authenticated;
GRANT ALL ON FUNCTION public.assign_quiet_panic_sequence_number() TO service_role;


--
-- Name: FUNCTION assign_story_number(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.assign_story_number() TO anon;
GRANT ALL ON FUNCTION public.assign_story_number() TO authenticated;
GRANT ALL ON FUNCTION public.assign_story_number() TO service_role;


--
-- Name: FUNCTION capacity_snapshot(p_days integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.capacity_snapshot(p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.capacity_snapshot(p_days integer) TO service_role;


--
-- Name: FUNCTION check_qp_posts_title_consistency(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_qp_posts_title_consistency() TO anon;
GRANT ALL ON FUNCTION public.check_qp_posts_title_consistency() TO authenticated;
GRANT ALL ON FUNCTION public.check_qp_posts_title_consistency() TO service_role;


--
-- Name: FUNCTION check_video_posts_title_consistency(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_video_posts_title_consistency() TO anon;
GRANT ALL ON FUNCTION public.check_video_posts_title_consistency() TO authenticated;
GRANT ALL ON FUNCTION public.check_video_posts_title_consistency() TO service_role;


--
-- Name: FUNCTION classify_rejection_reason(p_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.classify_rejection_reason(p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.classify_rejection_reason(p_reason text) TO anon;
GRANT ALL ON FUNCTION public.classify_rejection_reason(p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.classify_rejection_reason(p_reason text) TO service_role;


--
-- Name: FUNCTION clear_regeneration_priority_on_requeue(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.clear_regeneration_priority_on_requeue() TO anon;
GRANT ALL ON FUNCTION public.clear_regeneration_priority_on_requeue() TO authenticated;
GRANT ALL ON FUNCTION public.clear_regeneration_priority_on_requeue() TO service_role;


--
-- Name: FUNCTION compute_index_tier(p_name text, p_theme text, p_year integer, p_has_price boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.compute_index_tier(p_name text, p_theme text, p_year integer, p_has_price boolean) TO anon;
GRANT ALL ON FUNCTION public.compute_index_tier(p_name text, p_theme text, p_year integer, p_has_price boolean) TO authenticated;
GRANT ALL ON FUNCTION public.compute_index_tier(p_name text, p_theme text, p_year integer, p_has_price boolean) TO service_role;


--
-- Name: FUNCTION db_usage_report(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.db_usage_report() FROM PUBLIC;
GRANT ALL ON FUNCTION public.db_usage_report() TO service_role;


--
-- Name: FUNCTION get_distinct_themes(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_distinct_themes() TO anon;
GRANT ALL ON FUNCTION public.get_distinct_themes() TO authenticated;
GRANT ALL ON FUNCTION public.get_distinct_themes() TO service_role;


--
-- Name: FUNCTION price_history_on_change(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.price_history_on_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.price_history_on_change() TO service_role;


--
-- Name: FUNCTION reconcile_page_load_errors(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.reconcile_page_load_errors() TO anon;
GRANT ALL ON FUNCTION public.reconcile_page_load_errors() TO authenticated;
GRANT ALL ON FUNCTION public.reconcile_page_load_errors() TO service_role;


--
-- Name: FUNCTION reject_video_post(p_video_id uuid, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.reject_video_post(p_video_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reject_video_post(p_video_id uuid, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.reject_video_post(p_video_id uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.reject_video_post(p_video_id uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION reserve_story_number(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.reserve_story_number() FROM PUBLIC;
GRANT ALL ON FUNCTION public.reserve_story_number() TO service_role;


--
-- Name: FUNCTION run_retention(p_days integer, p_archive_days integer, p_dry_run boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.run_retention(p_days integer, p_archive_days integer, p_dry_run boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.run_retention(p_days integer, p_archive_days integer, p_dry_run boolean) TO service_role;


--
-- Name: FUNCTION set_approved_at(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.set_approved_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_approved_at() TO service_role;


--
-- Name: FUNCTION set_page_data(p_set_number text, p_slug text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.set_page_data(p_set_number text, p_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_page_data(p_set_number text, p_slug text) TO service_role;


--
-- Name: FUNCTION sets_bulk_patch(p_rows jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.sets_bulk_patch(p_rows jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sets_bulk_patch(p_rows jsonb) TO service_role;


--
-- Name: FUNCTION sync_index_tier_for_set(p_set_number text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_index_tier_for_set(p_set_number text) TO anon;
GRANT ALL ON FUNCTION public.sync_index_tier_for_set(p_set_number text) TO authenticated;
GRANT ALL ON FUNCTION public.sync_index_tier_for_set(p_set_number text) TO service_role;


--
-- Name: FUNCTION trg_sync_index_tier_on_sets(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_sync_index_tier_on_sets() TO anon;
GRANT ALL ON FUNCTION public.trg_sync_index_tier_on_sets() TO authenticated;
GRANT ALL ON FUNCTION public.trg_sync_index_tier_on_sets() TO service_role;


--
-- Name: FUNCTION trg_sync_index_tier_on_store_prices(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_sync_index_tier_on_store_prices() TO anon;
GRANT ALL ON FUNCTION public.trg_sync_index_tier_on_store_prices() TO authenticated;
GRANT ALL ON FUNCTION public.trg_sync_index_tier_on_store_prices() TO service_role;


--
-- Name: FUNCTION trg_sync_index_tier_on_store_prices_delete(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_sync_index_tier_on_store_prices_delete() TO anon;
GRANT ALL ON FUNCTION public.trg_sync_index_tier_on_store_prices_delete() TO authenticated;
GRANT ALL ON FUNCTION public.trg_sync_index_tier_on_store_prices_delete() TO service_role;


--
-- Name: FUNCTION update_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at() TO service_role;


--
-- Name: TABLE content_performance; Type: ACL; Schema: growth; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE growth.content_performance TO growth_service;


--
-- Name: TABLE forecasts; Type: ACL; Schema: growth; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE growth.forecasts TO growth_service;
GRANT SELECT ON TABLE growth.forecasts TO growth_dashboard;


--
-- Name: COLUMN forecasts.status; Type: ACL; Schema: growth; Owner: postgres
--

GRANT UPDATE(status) ON TABLE growth.forecasts TO growth_dashboard;


--
-- Name: TABLE ingestion_runs; Type: ACL; Schema: growth; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE growth.ingestion_runs TO growth_service;


--
-- Name: TABLE insights; Type: ACL; Schema: growth; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE growth.insights TO growth_service;


--
-- Name: TABLE newsletter_drafts; Type: ACL; Schema: growth; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE growth.newsletter_drafts TO growth_service;
GRANT SELECT ON TABLE growth.newsletter_drafts TO growth_dashboard;
GRANT SELECT ON TABLE growth.newsletter_drafts TO service_role;


--
-- Name: COLUMN newsletter_drafts.id; Type: ACL; Schema: growth; Owner: postgres
--

GRANT SELECT(id) ON TABLE growth.newsletter_drafts TO growth_webhook;


--
-- Name: COLUMN newsletter_drafts.status; Type: ACL; Schema: growth; Owner: postgres
--

GRANT UPDATE(status) ON TABLE growth.newsletter_drafts TO growth_dashboard;


--
-- Name: COLUMN newsletter_drafts.resend_broadcast_id; Type: ACL; Schema: growth; Owner: postgres
--

GRANT UPDATE(resend_broadcast_id) ON TABLE growth.newsletter_drafts TO growth_service;
GRANT SELECT(resend_broadcast_id) ON TABLE growth.newsletter_drafts TO growth_webhook;


--
-- Name: COLUMN newsletter_drafts.is_test_send; Type: ACL; Schema: growth; Owner: postgres
--

GRANT UPDATE(is_test_send) ON TABLE growth.newsletter_drafts TO growth_service;


--
-- Name: TABLE newsletter_events; Type: ACL; Schema: growth; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE growth.newsletter_events TO growth_service;
GRANT INSERT ON TABLE growth.newsletter_events TO growth_webhook;
GRANT SELECT ON TABLE growth.newsletter_events TO growth_dashboard;
GRANT SELECT,INSERT ON TABLE growth.newsletter_events TO service_role;


--
-- Name: COLUMN newsletter_events.svix_id; Type: ACL; Schema: growth; Owner: postgres
--

GRANT SELECT(svix_id) ON TABLE growth.newsletter_events TO growth_webhook;


--
-- Name: TABLE newsletter_issue_summary; Type: ACL; Schema: growth; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE growth.newsletter_issue_summary TO growth_service;
GRANT SELECT ON TABLE growth.newsletter_issue_summary TO growth_dashboard;


--
-- Name: TABLE platform_metrics_daily; Type: ACL; Schema: growth; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE growth.platform_metrics_daily TO growth_service;


--
-- Name: TABLE reddit_activity; Type: ACL; Schema: growth; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE growth.reddit_activity TO growth_service;


--
-- Name: TABLE subscribers; Type: ACL; Schema: growth; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE growth.subscribers TO growth_service;
GRANT SELECT,INSERT,UPDATE ON TABLE growth.subscribers TO growth_subscriber_sync;


--
-- Name: TABLE blog_posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.blog_posts TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.blog_posts TO authenticated;
GRANT ALL ON TABLE public.blog_posts TO service_role;


--
-- Name: TABLE capacity_usage_snapshots; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.capacity_usage_snapshots TO service_role;


--
-- Name: TABLE catalog_coverage_trend; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.catalog_coverage_trend TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.catalog_coverage_trend TO authenticated;
GRANT ALL ON TABLE public.catalog_coverage_trend TO service_role;


--
-- Name: TABLE cmf_figures; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.cmf_figures TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.cmf_figures TO authenticated;
GRANT ALL ON TABLE public.cmf_figures TO service_role;


--
-- Name: TABLE community_spotlights; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.community_spotlights TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.community_spotlights TO authenticated;
GRANT ALL ON TABLE public.community_spotlights TO service_role;


--
-- Name: SEQUENCE community_spotlights_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.community_spotlights_id_seq TO anon;
GRANT ALL ON SEQUENCE public.community_spotlights_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.community_spotlights_id_seq TO service_role;


--
-- Name: TABLE content_fix_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.content_fix_log TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.content_fix_log TO authenticated;
GRANT ALL ON TABLE public.content_fix_log TO service_role;


--
-- Name: TABLE content_image_registry; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.content_image_registry TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.content_image_registry TO authenticated;
GRANT ALL ON TABLE public.content_image_registry TO service_role;


--
-- Name: TABLE content_quality_issues; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.content_quality_issues TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.content_quality_issues TO authenticated;
GRANT ALL ON TABLE public.content_quality_issues TO service_role;


--
-- Name: TABLE content_quality_issues_archive; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.content_quality_issues_archive TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.content_quality_issues_archive TO authenticated;
GRANT ALL ON TABLE public.content_quality_issues_archive TO service_role;


--
-- Name: TABLE content_rejection_reminders; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.content_rejection_reminders TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.content_rejection_reminders TO authenticated;
GRANT ALL ON TABLE public.content_rejection_reminders TO service_role;


--
-- Name: TABLE content_rejections; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.content_rejections TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.content_rejections TO authenticated;
GRANT ALL ON TABLE public.content_rejections TO service_role;


--
-- Name: TABLE featured_videos; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.featured_videos TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.featured_videos TO authenticated;
GRANT ALL ON TABLE public.featured_videos TO service_role;


--
-- Name: SEQUENCE featured_videos_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.featured_videos_id_seq TO anon;
GRANT ALL ON SEQUENCE public.featured_videos_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.featured_videos_id_seq TO service_role;


--
-- Name: TABLE generator_runs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.generator_runs TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.generator_runs TO authenticated;
GRANT ALL ON TABLE public.generator_runs TO service_role;


--
-- Name: TABLE guides; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.guides TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.guides TO authenticated;
GRANT ALL ON TABLE public.guides TO service_role;
GRANT SELECT ON TABLE public.guides TO growth_service;


--
-- Name: SEQUENCE guides_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.guides_id_seq TO anon;
GRANT ALL ON SEQUENCE public.guides_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.guides_id_seq TO service_role;


--
-- Name: TABLE image_repair_queue; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.image_repair_queue TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.image_repair_queue TO authenticated;
GRANT ALL ON TABLE public.image_repair_queue TO service_role;


--
-- Name: TABLE news_articles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.news_articles TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.news_articles TO authenticated;
GRANT ALL ON TABLE public.news_articles TO service_role;
GRANT SELECT ON TABLE public.news_articles TO growth_service;


--
-- Name: TABLE newsletter_subscribers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.newsletter_subscribers TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.newsletter_subscribers TO authenticated;
GRANT ALL ON TABLE public.newsletter_subscribers TO service_role;
GRANT SELECT ON TABLE public.newsletter_subscribers TO growth_subscriber_sync;


--
-- Name: TABLE opinion_cadence_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.opinion_cadence_log TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.opinion_cadence_log TO authenticated;
GRANT ALL ON TABLE public.opinion_cadence_log TO service_role;


--
-- Name: SEQUENCE opinion_cadence_log_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.opinion_cadence_log_id_seq TO anon;
GRANT ALL ON SEQUENCE public.opinion_cadence_log_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.opinion_cadence_log_id_seq TO service_role;


--
-- Name: TABLE pending_drafts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.pending_drafts TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.pending_drafts TO authenticated;
GRANT ALL ON TABLE public.pending_drafts TO service_role;


--
-- Name: TABLE pending_drafts_lint_results_backup_20260620; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.pending_drafts_lint_results_backup_20260620 TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.pending_drafts_lint_results_backup_20260620 TO authenticated;
GRANT ALL ON TABLE public.pending_drafts_lint_results_backup_20260620 TO service_role;


--
-- Name: TABLE posted_lego_sets; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.posted_lego_sets TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.posted_lego_sets TO authenticated;
GRANT ALL ON TABLE public.posted_lego_sets TO service_role;


--
-- Name: SEQUENCE posted_lego_sets_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.posted_lego_sets_id_seq TO anon;
GRANT ALL ON SEQUENCE public.posted_lego_sets_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.posted_lego_sets_id_seq TO service_role;


--
-- Name: TABLE posted_sets; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.posted_sets TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.posted_sets TO authenticated;
GRANT ALL ON TABLE public.posted_sets TO service_role;


--
-- Name: SEQUENCE posted_sets_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.posted_sets_id_seq TO anon;
GRANT ALL ON SEQUENCE public.posted_sets_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.posted_sets_id_seq TO service_role;


--
-- Name: TABLE price_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.price_history TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.price_history TO authenticated;
GRANT ALL ON TABLE public.price_history TO service_role;
GRANT SELECT ON TABLE public.price_history TO growth_service;


--
-- Name: TABLE price_snapshots; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.price_snapshots TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.price_snapshots TO authenticated;
GRANT ALL ON TABLE public.price_snapshots TO service_role;


--
-- Name: SEQUENCE price_snapshots_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.price_snapshots_id_seq TO anon;
GRANT ALL ON SEQUENCE public.price_snapshots_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.price_snapshots_id_seq TO service_role;


--
-- Name: TABLE prices; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.prices TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.prices TO authenticated;
GRANT ALL ON TABLE public.prices TO service_role;


--
-- Name: TABLE publish_attempts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.publish_attempts TO service_role;


--
-- Name: SEQUENCE publish_attempts_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.publish_attempts_id_seq TO anon;
GRANT ALL ON SEQUENCE public.publish_attempts_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.publish_attempts_id_seq TO service_role;


--
-- Name: TABLE quiet_panic_posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.quiet_panic_posts TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.quiet_panic_posts TO authenticated;
GRANT ALL ON TABLE public.quiet_panic_posts TO service_role;


--
-- Name: TABLE raw_signals; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.raw_signals TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.raw_signals TO authenticated;
GRANT ALL ON TABLE public.raw_signals TO service_role;


--
-- Name: TABLE reviews; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.reviews TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.reviews TO authenticated;
GRANT ALL ON TABLE public.reviews TO service_role;
GRANT SELECT ON TABLE public.reviews TO growth_service;


--
-- Name: TABLE sets; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.sets TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.sets TO authenticated;
GRANT ALL ON TABLE public.sets TO service_role;
GRANT SELECT ON TABLE public.sets TO growth_service;


--
-- Name: TABLE store_prices; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.store_prices TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.store_prices TO authenticated;
GRANT ALL ON TABLE public.store_prices TO service_role;
GRANT SELECT ON TABLE public.store_prices TO growth_service;


--
-- Name: TABLE set_price_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,MAINTAIN ON TABLE public.set_price_summary TO service_role;


--
-- Name: TABLE social_automation_heartbeat; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.social_automation_heartbeat TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.social_automation_heartbeat TO authenticated;
GRANT ALL ON TABLE public.social_automation_heartbeat TO service_role;


--
-- Name: TABLE v_published_articles_public; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.v_published_articles_public TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.v_published_articles_public TO authenticated;
GRANT ALL ON TABLE public.v_published_articles_public TO service_role;


--
-- Name: TABLE v_scan_batch_health; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.v_scan_batch_health TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.v_scan_batch_health TO authenticated;
GRANT ALL ON TABLE public.v_scan_batch_health TO service_role;


--
-- Name: TABLE video_posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.video_posts TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.video_posts TO authenticated;
GRANT ALL ON TABLE public.video_posts TO service_role;


--
-- Name: SEQUENCE video_posts_story_number_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.video_posts_story_number_seq TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: growth; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA growth GRANT SELECT,INSERT,UPDATE ON TABLES TO growth_service;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- [platform default, not reproducible as postgres] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
-- [platform default, not reproducible as postgres] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
-- [platform default, not reproducible as postgres] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
-- [platform default, not reproducible as postgres] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- [platform default, not reproducible as postgres] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
-- [platform default, not reproducible as postgres] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
-- [platform default, not reproducible as postgres] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
-- [platform default, not reproducible as postgres] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- [platform default, not reproducible as postgres] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
-- [platform default, not reproducible as postgres] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
-- [platform default, not reproducible as postgres] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
-- [platform default, not reproducible as postgres] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

-- ── Storage buckets (config only, not objects) ───────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('quiet-panic-assets',  'quiet-panic-assets',  true,  NULL, NULL),
  ('social-assets',       'social-assets',       true,  NULL, NULL),
  ('video-master-assets', 'video-master-assets', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ── pg_cron jobs (1 in production) ──────────────────────────────────────────
SELECT cron.schedule('reconcile-page-load-errors-hourly', '15 * * * *', $$SELECT public.reconcile_page_load_errors();$$);
