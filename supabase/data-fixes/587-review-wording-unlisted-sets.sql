-- boi:issue 587
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where slug in ('lego-77059-timmy-tommys-fun-day-out-worth-5400', 'lego-olivia-rodrigos-dual-guitar-43031-worth-15400', 'lego-sagrada-famlia-21065-worth-76400', 'lego-sagrada-famlia-21065-worth-76400-2', 'lego-ideas-21373-downton-abbey-worth-33600', 'lego-mewtwos-lab-break-72163-worth-6700', 'lego-privateer-frigate-fortuna-910059-a-pirates-dream-or-a-w') and (position('official MRP' in content) > 0 or position('The price is right' in content) > 0) = 7
-- boi:expect-after select count(*) from public.reviews where slug in ('lego-77059-timmy-tommys-fun-day-out-worth-5400', 'lego-sagrada-famlia-21065-worth-76400', 'lego-sagrada-famlia-21065-worth-76400-2', 'lego-ideas-21373-downton-abbey-worth-33600', 'lego-mewtwos-lab-break-72163-worth-6700', 'lego-privateer-frigate-fortuna-910059-a-pirates-dream-or-a-w') and position($s$our estimate; LEGO India hasn't confirmed it$s$ in content) > 0 = 6
-- Replaces the official-price wording on seven published reviews with estimate wording, and moves two of them from BUY NOW to WAIT.
-- Each replacement must match exactly once in its review; if any text is missing or repeated, nothing is changed.
-- Nothing else in any review is changed.

DO $do$
DECLARE
  rec record;
  c text;
  n integer;
  moved integer;
BEGIN
  CREATE TEMP TABLE fix_edits (ord integer, slug text, old_text text, new_text text) ON COMMIT DROP;
  INSERT INTO fix_edits (ord, slug, old_text, new_text) VALUES
    (1, 'lego-77059-timmy-tommys-fun-day-out-worth-5400',
     $s$At ₹5,400 (official MRP), that's 12 months of Spotify Premium.$s$,
     $s$At an expected ₹5,400 (our estimate; LEGO India hasn't confirmed it), that's 12 months of Spotify Premium.$s$),
    (2, 'lego-77059-timmy-tommys-fun-day-out-worth-5400',
     $s$now is the moment to click “add to cart.”$s$,
     $s$wait for the Indian listing, then click “add to cart.”$s$),
    (3, 'lego-77059-timmy-tommys-fun-day-out-worth-5400',
     $s$Verdict: BUY NOW. The price is right — grab it.$s$,
     $s$Verdict: WAIT. Good set, but you can't buy it in India yet.$s$),
    (4, 'lego-77059-timmy-tommys-fun-day-out-worth-5400',
     $s$Standard disclaimer: if you've got the money, obviously buy it — that's what the verdict says too, for once we all agree.$s$,
     $s$Standard disclaimer: if you're rich, you can skip the verdict and just buy it. The rest of us will be here doing math before we hit checkout.$s$),
    (5, 'lego-olivia-rodrigos-dual-guitar-43031-worth-15400',
     $s$Verdict: BUY NOW. The price is right — grab it.$s$,
     $s$Verdict: WAIT. Good set, but official Indian pricing isn't announced yet.$s$),
    (6, 'lego-olivia-rodrigos-dual-guitar-43031-worth-15400',
     $s$Standard disclaimer: if you've got the money, obviously buy it — that's what the verdict says too, for once we all agree.$s$,
     $s$Standard disclaimer: if you're rich, you can skip the verdict and just buy it. The rest of us will be here doing math before we hit checkout.$s$),
    (7, 'lego-sagrada-famlia-21065-worth-76400',
     $s$has an official MRP of ₹76,400$s$,
     $s$has an expected price of ₹76,400 (our estimate; LEGO India hasn't confirmed it)$s$),
    (8, 'lego-sagrada-famlia-21065-worth-76400-2',
     $s$carries an official MRP of ₹76,400$s$,
     $s$carries an expected price of ₹76,400 (our estimate; LEGO India hasn't confirmed it)$s$),
    (9, 'lego-ideas-21373-downton-abbey-worth-33600',
     $s$The set is listed with an official MRP of ₹33,600.$s$,
     $s$The set has an expected price of ₹33,600 (our estimate; LEGO India hasn't confirmed it).$s$),
    (10, 'lego-mewtwos-lab-break-72163-worth-6700',
     $s$At ₹6,700 (official MRP),$s$,
     $s$At an expected ₹6,700 (our estimate; LEGO India hasn't confirmed it),$s$),
    (11, 'lego-privateer-frigate-fortuna-910059-a-pirates-dream-or-a-w',
     $s$has an official MRP of ₹31,500$s$,
     $s$has an expected price of ₹31,500 (our estimate; LEGO India hasn't confirmed it)$s$);

  -- Check every edit before changing anything: the review exists and the old text occurs exactly once in it.
  FOR rec IN SELECT * FROM fix_edits ORDER BY ord LOOP
    SELECT content INTO c FROM public.reviews WHERE slug = rec.slug;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'review % not found; nothing changed', rec.slug;
    END IF;
    n := (length(c) - length(replace(c, rec.old_text, ''))) / length(rec.old_text);
    IF n <> 1 THEN
      RAISE EXCEPTION 'edit % in % matched % times (need 1); nothing changed', rec.ord, rec.slug, n;
    END IF;
  END LOOP;

  -- Verdicts: only the two BUY NOW reviews move to WAIT, and only if they are still BUY NOW.
  FOR rec IN SELECT * FROM (VALUES ('lego-77059-timmy-tommys-fun-day-out-worth-5400'), ('lego-olivia-rodrigos-dual-guitar-43031-worth-15400')) AS v(slug) LOOP
    IF (SELECT verdict FROM public.reviews WHERE slug = rec.slug) IS DISTINCT FROM 'BUY NOW' THEN
      RAISE EXCEPTION 'review % is not BUY NOW; nothing changed', rec.slug;
    END IF;
  END LOOP;

  FOR rec IN SELECT * FROM fix_edits ORDER BY ord LOOP
    UPDATE public.reviews SET content = replace(content, rec.old_text, rec.new_text) WHERE slug = rec.slug;
  END LOOP;

  UPDATE public.reviews SET verdict = 'WAIT'
  WHERE slug IN ('lego-77059-timmy-tommys-fun-day-out-worth-5400', 'lego-olivia-rodrigos-dual-guitar-43031-worth-15400')
    AND verdict = 'BUY NOW';
  GET DIAGNOSTICS moved = ROW_COUNT;
  IF moved <> 2 THEN
    RAISE EXCEPTION 'expected 2 verdicts moved to WAIT, moved %; nothing changed', moved;
  END IF;

  -- After the edits, every new text must be present in its review.
  FOR rec IN SELECT * FROM fix_edits ORDER BY ord LOOP
    IF NOT EXISTS (SELECT 1 FROM public.reviews WHERE slug = rec.slug AND position(rec.new_text in content) > 0) THEN
      RAISE EXCEPTION 'edit % missing after update in %; nothing changed', rec.ord, rec.slug;
    END IF;
  END LOOP;
END
$do$;
