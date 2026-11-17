"""Planned-slot coverage: decide whether a planned post slot has passed with no post.

Pure logic, no network. The caller reads the facts (see slot_coverage_db.py) and
passes them in. One alert per slot: the caller records a key per slot and never
sends twice for the same key.

Rule (per slot):
  * a slot is due once `hours` have passed since its start (IST);
  * if any post went live in [slot start, now], no alert;
  * otherwise one alert, with the cause as far as the facts show:
      - a row is blocked (publish_blocked, or approved but not posted) -> blocked, with its recorded reason;
      - a row is waiting for owner approval -> pending;
      - no row at all -> nothing produced, cause not known.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
LOOKBACK_DAYS = 7

# Planned slots. weekdays use Python's Monday=0. `hours` is how long after the
# slot start we wait before calling it missed. Chosen from the observed posting
# times (4 h, 7 h, 10 h) plus margin for the slots whose generation runs later.
SLOTS = {
    'VID-P4': {'weekdays': frozenset({2, 4, 6}), 'start': (19, 30), 'hours': 12, 'label': 'VID-P4 video'},
    'VID-QP': {'weekdays': frozenset({1, 3, 5}), 'start': (0, 0), 'hours': 18, 'label': 'Quiet Panic video'},
    'SOCIAL': {'weekdays': frozenset({0}), 'start': (12, 0), 'hours': 12, 'label': 'Weekly social post'},
}


@dataclass
class Facts:
    """What the database shows for one slot. Lists hold plain dicts from the reads."""
    posted: list = field(default_factory=list)       # rows with a post time in [slot start, now]
    blocked: list = field(default_factory=list)      # {row_number, set_title, status, reason}
    pending: list = field(default_factory=list)      # {row_number, set_title, status}


@dataclass
class Alert:
    key: str
    kind: str                # 'blocked' | 'pending' | 'nothing'
    subject: str
    body_lines: list


def slot_start_ist(key: str, day: date) -> datetime:
    hh, mm = SLOTS[key]['start']
    return datetime(day.year, day.month, day.day, hh, mm, tzinfo=IST)


def is_slot_day(key: str, day: date) -> bool:
    return day.weekday() in SLOTS[key]['weekdays']


def latest_due_slot(key: str, now_utc: datetime) -> datetime | None:
    """Most recent slot start (IST, aware) whose wait has passed and is within the lookback."""
    now_ist = now_utc.astimezone(IST)
    hours = SLOTS[key]['hours']
    for back in range(0, LOOKBACK_DAYS + 1):
        day = (now_ist - timedelta(days=back)).date()
        if not is_slot_day(key, day):
            continue
        start = slot_start_ist(key, day)
        if start + timedelta(hours=hours) <= now_ist:
            return start
    return None


def dedupe_key(key: str, slot_start: datetime) -> str:
    return f"slot-no-post:{key}:{slot_start.astimezone(IST).strftime('%Y-%m-%d %H:%M')}"


def _fmt(dt: datetime) -> str:
    return dt.astimezone(IST).strftime('%a %d %b %Y, %H:%M IST')


def decide(key: str, slot_start: datetime, now_utc: datetime, facts: Facts) -> Alert | None:
    """Return the alert for this slot, or None when a post went live or the wait has not passed."""
    spec = SLOTS[key]
    now_ist = now_utc.astimezone(IST)
    if now_ist < slot_start + timedelta(hours=spec['hours']):
        return None
    if facts.posted:
        return None

    hours_since = (now_ist - slot_start).total_seconds() / 3600
    if facts.blocked:
        kind = 'blocked'
        cause = 'a row for this slot is blocked: ' + '; '.join(
            f"#{r.get('row_number')} ({r.get('status')}): {r.get('reason') or 'reason not recorded'}"
            for r in facts.blocked)
        cause_known = True
    elif facts.pending:
        kind = 'pending'
        cause = 'the row is waiting for owner approval: ' + '; '.join(
            f"#{r.get('row_number')} ({r.get('set_title') or 'untitled'})" for r in facts.pending)
        cause_known = True
    else:
        kind = 'nothing'
        cause = 'cause not known: no row was generated or approved for this slot'
        cause_known = False

    subject = f"🚨 {spec['label']} slot missed: {_fmt(slot_start)}, no post after {spec['hours']} hours"
    body = [
        f"Missed slot: {spec['label']}, planned {_fmt(slot_start)}.",
        f"Since when: {_fmt(slot_start)}; {hours_since:.1f} hours without a post.",
        "Visitors affected: not known (no visitor data is read by this alert).",
        f"Cause: {cause}.",
        "Cause status: " + ("known" if cause_known else "cause not known") + ". Fix: none recorded for this alert.",
        "Owner must act: yes.",
    ]
    return Alert(key=dedupe_key(key, slot_start), kind=kind, subject=subject, body_lines=body)
