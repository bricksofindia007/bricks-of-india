"""
brick_rush_auto.py: the scheduled run of the Brick Rush posts (Days 4-10).

Works out today's date in India, maps it to the campaign day (5 Oct = day4 ... 11 Oct = day10),
waits until 19:30:00 IST, posts the carousel, then the Short only if the carousel is posted.
Posting itself is post_prepared.py (approval check, copy check, one record per platform).

Does nothing when: the kill switch is off (repo variable BRICK_RUSH_AUTOPOST = "off"), today is not
a campaign day, the day is not approved in the manifest, or the piece is already posted.

  python brick_rush_auto.py --manifest campaigns/brick-rush-2026.json
"""
import argparse
import json
import os
import subprocess
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

IST = timezone(timedelta(hours=5, minutes=30))
FIRST_DATE, FIRST_DAY, LAST_DAY = date(2026, 10, 5), 4, 10
POST_AT = (19, 30)
PIECE_PLATFORMS = {'carousel': ['ig_feed'], 'short': ['ig_reels', 'yt_shorts']}


def campaign_day(today: date) -> str | None:
    """5 Oct 2026 -> 'day4' ... 11 Oct 2026 -> 'day10'; any other date -> None."""
    n = FIRST_DAY + (today - FIRST_DATE).days
    return f'day{n}' if FIRST_DAY <= n <= LAST_DAY else None


def kill_switch_on(value: str | None) -> bool:
    return (value or '').strip().lower() == 'off'


def piece_done(posted, cid: str, piece: str) -> bool:
    """A piece is done when every platform it posts to is recorded."""
    return all(posted(cid, p) for p in PIECE_PLATFORMS[piece])


def plan(today: date, manifest: dict, switch: str | None, posted) -> tuple[str | None, list[str], str]:
    """(day, pieces still to post in order, reason). An empty list means do nothing."""
    if kill_switch_on(switch):
        return None, [], 'kill switch is off'
    day = campaign_day(today)
    if day is None:
        return None, [], f'{today.isoformat()} is not a campaign day'
    entry = manifest.get('days', {}).get(day)
    if not entry:
        return day, [], f'{day} is not in the manifest'
    todo = []
    for piece in ('carousel', 'short'):
        item = entry.get(piece)
        if not item or item.get('approved') is not True:
            if piece == 'carousel':
                return day, [], f'{day} carousel is not approved'
            continue
        if not piece_done(posted, f"{manifest['id']}:{day}:{piece}", piece):
            todo.append(piece)
    return day, todo, 'ok' if todo else f'{day} already posted'


def seconds_until_post(now: datetime) -> float:
    target = now.astimezone(IST).replace(hour=POST_AT[0], minute=POST_AT[1], second=0, microsecond=0)
    return max(0.0, (target - now).total_seconds())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', required=True)
    ap.add_argument('--dry-run', action='store_true', help='report the plan, wait for nothing, post nothing')
    a = ap.parse_args()
    here = Path(__file__).parent
    manifest = json.loads((here / a.manifest).read_text(encoding='utf-8'))

    sys.path.insert(0, str(here))
    import post_prepared  # noqa: E402  (its already_posted reads the same records it writes)

    now = datetime.now(timezone.utc)
    day, todo, reason = plan(now.astimezone(IST).date(), manifest, os.environ.get('BRICK_RUSH_AUTOPOST'), post_prepared.already_posted)
    print(f'[auto] {reason}; to post: {todo or "nothing"}')
    if not todo or a.dry_run:
        return 0

    wait = seconds_until_post(now)
    if wait:
        print(f'[auto] waiting {int(wait)} s')
        time.sleep(wait)

    for piece in todo:
        if piece == 'short' and not piece_done(post_prepared.already_posted, f"{manifest['id']}:{day}:carousel", 'carousel'):
            print('[auto] carousel not posted, so the Short is not posted')
            return 1
        r = subprocess.run([sys.executable, 'post_prepared.py', '--manifest', a.manifest, '--day', day, '--piece', piece], cwd=here)
        if r.returncode != 0:
            print(f'[auto] {day} {piece} failed (exit {r.returncode})')
            return r.returncode
    return 0


if __name__ == '__main__':
    sys.exit(main())
