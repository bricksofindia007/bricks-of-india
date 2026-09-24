"""
missed_slot_watchdog.py -- issue #178 missed-slot watchdog, both pipelines.

Run the morning after each slot by .github/workflows/video-missed-slot-watchdog.yml
(00:15 UTC = 05:45 IST). For VID-P4 and VID-QP it judges the previous IST
day (cadence.watchdog_slot_day): if it was a slot day, an approved row was
waiting before the slot opened (or a publish was attempted), and nothing
went live on either platform, it emails an alert naming every blocked row
and the reason recorded in publish_attempts. One alert per pipeline per slot
day (deduped in publish_attempts). No silent skips: the summary for each
pipeline is always printed, and a failed alert send fails the job.

Usage:
  python missed_slot_watchdog.py                # judge yesterday (IST), send alerts
  python missed_slot_watchdog.py --dry-run      # print what would be alerted, send nothing
  python missed_slot_watchdog.py --now 2026-09-25T00:15:00Z   # simulate a run time
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

import cadence
from secrets_util import get_secret

load_dotenv(Path(__file__).parent / '.env')


def get_supabase():
    url = get_secret('SUPABASE_URL') or get_secret('NEXT_PUBLIC_SUPABASE_URL')
    key = get_secret('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print('ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set', file=sys.stderr)
        sys.exit(1)
    return create_client(url, key)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--dry-run', action='store_true', help='print alerts instead of sending them (no publish_attempts write)')
    parser.add_argument('--now', help='ISO UTC timestamp to simulate the run time')
    args = parser.parse_args()

    now_utc = (datetime.fromisoformat(args.now.replace('Z', '+00:00')) if args.now
               else datetime.now(timezone.utc))
    sb = get_supabase()

    def send(p, day, blocked):
        if args.dry_run:
            print(f'[dry-run] WOULD ALERT {p.label} missed slot {day}: {json.dumps(blocked, default=str, indent=2)}')
            raise _DryRunStop()
        import notifier
        notifier.send_missed_slot_alert(p.label, day.isoformat(), blocked)

    for p in (cadence.VIDP4, cadence.VIDQP):
        try:
            summary = cadence.check_missed_slot(sb, p, now_utc, send)
        except _DryRunStop:
            summary = {'pipeline': p.key, 'action': 'would_alert (dry-run, nothing recorded)'}
        print(json.dumps(summary, default=str))
    return 0


class _DryRunStop(Exception):
    """Raised by the dry-run sender so check_missed_slot() never records an
    'alerted' publish_attempts row for an alert that wasn't sent."""


if __name__ == '__main__':
    sys.exit(main())
