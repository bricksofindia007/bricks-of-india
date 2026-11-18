"""Planned-slot coverage: decide whether a planned post slot has passed with no post.

Pure logic, no network. The caller reads the facts (see slot_coverage_db.py) and
passes them in. One alert per slot: the caller records a key per slot and never
sends twice for the same key.

Rule (per slot):
  * a slot is due once `hours` have passed since its start (IST);
  * every due slot in the lookback is judged, each on its own;
  * if any post went live in [slot start, next slot start or now], no alert;
  * otherwise one alert, with the cause as far as the facts show:
      - a row is blocked (publish_blocked, or approved before the slot was due but not posted)
        -> blocked, with its recorded reason, or "no publish attempt was logged for this row";
      - a row is waiting for owner approval -> pending;
      - no row at all -> nothing produced, cause not known.
  * an approved row counts only if it was approved before the slot was due (its approved_at).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Callable

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
    posted: list = field(default_factory=list)       # rows with a post time in [slot start, window end]
    blocked: list = field(default_factory=list)      # {row_number, set_title, status, reason, approved_at}
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


def due_at(key: str, slot_start: datetime) -> datetime:
    """The moment a slot is called missed (IST, aware)."""
    return slot_start + timedelta(hours=SLOTS[key]['hours'])


def due_slots(key: str, now_utc: datetime) -> list[datetime]:
    """Every slot start (IST, aware) inside the lookback whose wait has passed, oldest first."""
    now_ist = now_utc.astimezone(IST)
    found = []
    for back in range(0, LOOKBACK_DAYS + 1):
        day = (now_ist - timedelta(days=back)).date()
        if not is_slot_day(key, day):
            continue
        start = slot_start_ist(key, day)
        if due_at(key, start) <= now_ist:
            found.append(start)
    return sorted(set(found))


def next_slot_start(key: str, slot_start: datetime) -> datetime | None:
    """The next planned slot start after this one (IST, aware), or None if none within a week."""
    day = slot_start.astimezone(IST).date()
    for ahead in range(1, 8):
        d = day + timedelta(days=ahead)
        if is_slot_day(key, d):
            return slot_start_ist(key, d)
    return None


def window_end(key: str, slot_start: datetime, now_utc: datetime) -> datetime:
    """End of the 'posted' window for a slot: the next slot's start, or now if that is later."""
    nxt = next_slot_start(key, slot_start)
    now_ist = now_utc.astimezone(IST)
    return min(nxt, now_ist) if nxt is not None else now_ist


def latest_due_slot(key: str, now_utc: datetime) -> datetime | None:
    """Most recent slot start (IST, aware) whose wait has passed and is within the lookback."""
    slots = due_slots(key, now_utc)
    return slots[-1] if slots else None


# The pipeline values the publish-attempts table accepts (vidp4, vidqp). Social has no such value,
# so its slot is never recorded (see slot_coverage_db.check_and_send). Order 1906.
PIPELINE_VALUE = {'VID-P4': 'vidp4', 'VID-QP': 'vidqp', 'SOCIAL': 'social'}


def dedupe_key(key: str, slot_start: datetime) -> str:
    return f"slot-no-post:{PIPELINE_VALUE[key]}:{slot_start.astimezone(IST).strftime('%Y-%m-%d %H:%M')}"


def _fmt(dt: datetime) -> str:
    return dt.astimezone(IST).strftime('%a %d %b %Y, %H:%M IST')


def _parse_ts(value) -> datetime | None:
    """A timestamp from the database (ISO string or datetime) as an aware datetime, or None."""
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _counts_for_slot(row: dict, due: datetime) -> bool:
    """A blocked-list row counts for a slot only if it was waiting when the slot was due.

    An approved row approved after the due time did not miss the slot. A row with no
    approved_at is counted (its approval time is unknown)."""
    if row.get('status') != 'approved':
        return True
    approved = _parse_ts(row.get('approved_at'))
    return approved is None or approved <= due


def decide(key: str, slot_start: datetime, now_utc: datetime, facts: Facts) -> Alert | None:
    """Return the alert for this slot, or None when a post went live or the wait has not passed."""
    spec = SLOTS[key]
    now_ist = now_utc.astimezone(IST)
    due = due_at(key, slot_start)
    if now_ist < due:
        return None
    if facts.posted:
        return None

    hours_since = (now_ist - slot_start).total_seconds() / 3600
    waiting = [r for r in facts.blocked if _counts_for_slot(r, due)]
    if waiting:
        kind = 'blocked'
        cause = 'a row for this slot is blocked: ' + '; '.join(
            f"#{r.get('row_number')} ({r.get('status')}): "
            f"{r.get('reason') or 'no publish attempt was logged for this row'}"
            for r in waiting)
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


def pending_alerts(key: str, now_utc: datetime,
                   facts_for: Callable[[datetime, datetime], Facts],
                   already: set, watch_from: datetime) -> list[Alert]:
    """Every missed slot in the lookback that has no alert yet, one alert per slot.

    watch_from is the watchdog's first enabled run. A slot is judged only if it fell due after
    that moment; slots due before it never alert (Chat decision, order 1898).
    facts_for(slot_start, window_end) returns the facts for that slot. `already` holds the
    dedupe keys of alerts sent before. Nothing is recorded here: the caller does that."""
    out = []
    watch = watch_from.astimezone(IST)
    for slot in due_slots(key, now_utc):
        if due_at(key, slot) <= watch:
            continue
        end = window_end(key, slot, now_utc)
        alert = decide(key, slot, now_utc, facts_for(slot, end))
        if alert is None or alert.key in already:
            continue
        out.append(alert)
    return out
