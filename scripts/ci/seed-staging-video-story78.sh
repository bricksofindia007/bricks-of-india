#!/usr/bin/env bash
# Staging only: one video_posts row for daily story 78 (Avengers Tower, set 76269), so fix 910 has a row to act on.
# Usage: seed-staging-video-story78.sh seed | remove
#   seed:   inserts exactly one row with a fixed id, status publish_blocked, story_number 78. Refuses if a row
#           already exists for that id or for story 78 and set 76269.
#   remove: deletes only that fixture row (the id, plus the fixture markers script and video_path = 'staging seed').
# Both run in ONE transaction and check the row count inside it. Both refuse the production project and any
# connection that is not the staging project. Nothing here reads production. The row is a fixture: it is removed
# when the staging rehearsal is over. (Staging seed; the production route is the db-migrate workflow only.)
set -euo pipefail
ROW_ID='a0000000-0000-4000-8000-000000000078'
STORY='78'
SET_NUMBER='76269'
PSQL="${PSQL:-psql}"
MODE="${1:-}"
case "$MODE" in seed|remove) ;; *) echo "REFUSED: the mode must be seed or remove"; exit 1 ;; esac
if printf '%s' "${STAGING_DB_URL:-}" | grep -q 'hqpaiarhmiocmjrzjhtw'; then echo "REFUSED: the connection is the production project"; exit 1; fi
if ! printf '%s' "${STAGING_DB_URL:-}" | grep -q 'vdixqwjiiifliepzufpc'; then echo "REFUSED: the connection is not the staging project"; exit 1; fi
echo "target check: staging project confirmed (value not printed)"

if [ "$MODE" = "seed" ]; then
$PSQL "$STAGING_DB_URL" -X -At -v ON_ERROR_STOP=1 <<SQL
begin;
do \$\$ declare n int; begin
  select count(*) into n from public.video_posts
  where id = '$ROW_ID' or (story_number = $STORY and set_number = '$SET_NUMBER');
  if n <> 0 then raise exception 'expected no staging row for story $STORY before the seed, found %', n; end if;
end \$\$;
insert into public.video_posts
  (id, set_title, set_number, store, product_url, price_inr, script, script_chars, gate_results, video_path, status, story_number)
values
  ('$ROW_ID', 'Avengers Tower', '$SET_NUMBER', 'mybrickhouse', 'https://example.invalid/staging-seed', 48999,
   'staging seed', 0, '{}'::jsonb, 'staging seed', 'publish_blocked', $STORY);
do \$\$ declare n int; begin
  select count(*) into n from public.video_posts
  where id = '$ROW_ID' and story_number = $STORY and set_number = '$SET_NUMBER' and status = 'publish_blocked';
  if n <> 1 then raise exception 'expected exactly one seeded row after the seed, found %', n; end if;
end \$\$;
commit;
SQL
else
$PSQL "$STAGING_DB_URL" -X -At -v ON_ERROR_STOP=1 <<SQL
begin;
do \$\$ declare n int; begin
  select count(*) into n from public.video_posts
  where id = '$ROW_ID' and script = 'staging seed' and video_path = 'staging seed';
  if n <> 1 then raise exception 'expected exactly one fixture row to remove, found %', n; end if;
end \$\$;
delete from public.video_posts where id = '$ROW_ID' and script = 'staging seed' and video_path = 'staging seed';
do \$\$ declare n int; begin
  select count(*) into n from public.video_posts where id = '$ROW_ID';
  if n <> 0 then raise exception 'expected no fixture row after the removal, found %', n; end if;
end \$\$;
commit;
SQL
fi
echo "done: mode $MODE"
