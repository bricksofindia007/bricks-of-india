#!/usr/bin/env bash
# Staging only: one video_posts row for daily story 78 (Avengers Tower, set 76269), so fix 910 has a row to act on.
# Also: the Quiet Panic rework row c4af5037 (set 40812, reworked from row 660c4b8f), so fix 911 has a row to act on.
# Its parent row 660c4b8f is a fixture too, because the rework row refers to it. Both rework rows are fixtures
# (script and video_path = 'staging seed'); the remove mode deletes them child first, then the parent.
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
REWORK_CHILD_ID='c4af5037-27f9-40db-ab03-1825cb5f888b'
REWORK_PARENT_ID='660c4b8f-9278-404e-9343-da305ec01769'
REWORK_SET_NUMBER='40812'
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
do \$\$ declare n int; begin
  select count(*) into n from public.quiet_panic_posts
  where id in ('$REWORK_PARENT_ID', '$REWORK_CHILD_ID');
  if n <> 0 then raise exception 'expected no staging rework rows before the seed, found %', n; end if;
end \$\$;
insert into public.quiet_panic_posts
  (id, set_title, set_number, price_inr, script, video_path, gate_results, status, rejection_reason, reworked)
values
  ('$REWORK_PARENT_ID', 'Snowman Ornaments', '$REWORK_SET_NUMBER', 1349,
   'staging seed', 'staging seed', '{}'::jsonb, 'rejected', 'staging seed', true);
insert into public.quiet_panic_posts
  (id, set_title, set_number, price_inr, script, video_path, gate_results, status, reworked_from)
values
  ('$REWORK_CHILD_ID', 'Snowman Ornaments', '$REWORK_SET_NUMBER', 1349,
   'staging seed', 'staging seed', '{}'::jsonb, 'pending_approval', '$REWORK_PARENT_ID');
do \$\$ declare n int; begin
  select count(*) into n from public.quiet_panic_posts
  where id = '$REWORK_CHILD_ID' and status = 'pending_approval' and reworked_from = '$REWORK_PARENT_ID'
    and script = 'staging seed' and video_path = 'staging seed';
  if n <> 1 then raise exception 'expected exactly one seeded rework row after the seed, found %', n; end if;
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
do \$\$ declare n int; begin
  select count(*) into n from public.quiet_panic_posts
  where id in ('$REWORK_CHILD_ID', '$REWORK_PARENT_ID') and script = 'staging seed' and video_path = 'staging seed';
  if n <> 2 then raise exception 'expected exactly two rework fixture rows to remove, found %', n; end if;
end \$\$;
delete from public.quiet_panic_posts where id = '$REWORK_CHILD_ID' and script = 'staging seed' and video_path = 'staging seed';
delete from public.quiet_panic_posts where id = '$REWORK_PARENT_ID' and script = 'staging seed' and video_path = 'staging seed';
do \$\$ declare n int; begin
  select count(*) into n from public.quiet_panic_posts where id in ('$REWORK_CHILD_ID', '$REWORK_PARENT_ID');
  if n <> 0 then raise exception 'expected no rework fixture rows after the removal, found %', n; end if;
end \$\$;
commit;
SQL
fi
echo "done: mode $MODE"
