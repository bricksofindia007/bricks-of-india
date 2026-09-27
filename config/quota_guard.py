"""
FP6.4 hard quota guards, Python side (P4 Step 2, 27 Sep 2026).

Mirror of scripts/lib/quota-guard.mjs for the Python media pipelines
(VID-P4, VID-QP, social). Same in-database readings Check 11/11b use
(public.db_usage_report(), public.capacity_snapshot()), same thresholds, same
BOI_QUOTA_SIMULATE override. tests: config/test_quota_guard.py.

  may_upload(u)               storage: alert >= 700 MB, REFUSE >= 800 MB
  may_write_non_essential(u)  DB size: alert >= 350 MB, PAUSE  >= 400 MB
  may_read_non_essential(u)   egress:  alert >= 3.5 GB projected, PAUSE >= 4.0 GB projected

Media uploads are NON-essential (P4 Step 2e), so an unreadable usage reading
refuses them (fail closed).

On an upload refusal the caller:
  1. never touches Storage,
  2. alerts through its pipeline's EXISTING sender (no new provider call),
  3. dispatches the #183 cleanup workflow (cleanup-published-assets.yml) via
     the GitHub API with the job's own GITHUB_TOKEN (needs `actions: write`).
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

STORAGE_ALERT_MB, STORAGE_BLOCK_MB = 700.0, 800.0
DB_ALERT_MB, DB_BLOCK_MB = 350.0, 400.0
EGRESS_ALERT_GB, EGRESS_BLOCK_GB = 3.5, 4.0

# Same calibration as scripts/lib/capacity-estimate.mjs (keep in sync; the
# shared test vector in config/test_quota_guard.py pins both).
CALLS_PER_REQUEST = 2.25
EGRESS_BYTES_PER_REQUEST = 2770
CYCLE_ANCHOR_DAY = 11

CLEANUP_WORKFLOW = 'cleanup-published-assets.yml'


class QuotaBlockedError(RuntimeError):
    """Raised BEFORE any Storage call when the upload guard is closed."""


def parse_simulation(raw: str | None = None) -> dict | None:
    raw = os.environ.get('BOI_QUOTA_SIMULATE') if raw is None else raw
    if not raw:
        return None
    out = {}
    for part in raw.split(','):
        if '=' not in part:
            continue
        k, v = (x.strip() for x in part.split('=', 1))
        if k in ('storage_mb', 'db_mb', 'egress_projected_gb'):
            try:
                out[k] = float(v)
            except ValueError:
                pass
    return out or None


def _cycle_start(now: datetime) -> datetime:
    this_month = datetime(now.year, now.month, CYCLE_ANCHOR_DAY, tzinfo=timezone.utc)
    if now >= this_month:
        return this_month
    y, m = (now.year, now.month - 1) if now.month > 1 else (now.year - 1, 12)
    return datetime(y, m, CYCLE_ANCHOR_DAY, tzinfo=timezone.utc)


def _cycle_end(start: datetime) -> datetime:
    y, m = (start.year, start.month + 1) if start.month < 12 else (start.year + 1, 1)
    return datetime(y, m, start.day, tzinfo=timezone.utc)


def projected_egress_gb(snapshots: list[dict], now: datetime) -> float | None:
    """Port of estimateCycleUsage()'s projectedEgressGB (capacity-estimate.mjs)."""
    start, end = _cycle_start(now), None
    end = _cycle_end(start)
    rows = []
    for s in snapshots:
        try:
            t = datetime.fromisoformat(str(s['taken_at']).replace('Z', '+00:00'))
            if t.tzinfo is None:
                t = t.replace(tzinfo=timezone.utc)
            rows.append((t, float(s['api_calls'])))
        except (KeyError, TypeError, ValueError):
            continue
    rows.sort(key=lambda r: r[0])
    before = [r for r in rows if r[0] < start]
    inside = [r for r in rows if start <= r[0] <= now]
    series = ([before[-1]] if before else []) + inside
    if len(series) < 2:
        return None
    calls = 0.0
    for i in range(1, len(series)):
        d = series[i][1] - series[i - 1][1]
        calls += d if d >= 0 else series[i][1]
    span_ms = (series[-1][0] - series[0][0]).total_seconds() * 1000
    elapsed_ms = (now - start).total_seconds() * 1000
    cycle_ms = (end - start).total_seconds() * 1000
    rate = calls / span_ms if span_ms > 0 else 0.0
    requests = rate * elapsed_ms / CALLS_PER_REQUEST
    egress_gb = requests * EGRESS_BYTES_PER_REQUEST / 1e9
    return egress_gb * (cycle_ms / elapsed_ms)


def read_usage(sb, now: datetime | None = None, simulate: dict | None = None) -> dict:
    """{'ok', 'storage_mb', 'db_mb', 'egress_projected_gb', 'simulated', 'error'}."""
    now = now or datetime.now(timezone.utc)
    simulate = parse_simulation() if simulate is None else simulate
    live = {'storage_mb': None, 'db_mb': None, 'egress_projected_gb': None}
    error = None
    try:
        rep = sb.rpc('db_usage_report').execute().data
        snaps = sb.rpc('capacity_snapshot', {'p_days': 40}).execute().data or []
        live = {
            'storage_mb': float(rep['storage_mb']),
            'db_mb': float(rep['db_size_mb']),
            'egress_projected_gb': projected_egress_gb(snaps, now),
        }
    except Exception as exc:  # noqa: BLE001 -- any read failure means "unreadable"
        error = f'{type(exc).__name__}: {exc}'
    u = {k: (simulate or {}).get(k, v) for k, v in live.items()}
    ok = all(isinstance(v, (int, float)) for v in u.values())
    return {'ok': ok, **u, 'simulated': bool(simulate), 'error': None if ok else (error or 'egress estimate unavailable')}


def _decide(value, alert_at, block_at, unit, what) -> dict:
    if not isinstance(value, (int, float)):
        return {'allowed': False, 'level': 'critical', 'reason': 'usage-unreadable', 'detail': f'{what} usage could not be read'}
    if value >= block_at:
        return {'allowed': False, 'level': 'critical', 'reason': f'{what}-block', 'detail': f'{what} {value} {unit} >= {block_at} {unit} guard'}
    if value >= alert_at:
        return {'allowed': True, 'level': 'warning', 'reason': f'{what}-alert', 'detail': f'{what} {value} {unit} >= {alert_at} {unit} alert line'}
    return {'allowed': True, 'level': 'ok', 'reason': 'ok', 'detail': f'{what} {value} {unit}'}


def may_upload(u: dict) -> dict:
    return _decide(u.get('storage_mb'), STORAGE_ALERT_MB, STORAGE_BLOCK_MB, 'MB', 'storage')


def may_write_non_essential(u: dict) -> dict:
    return _decide(u.get('db_mb'), DB_ALERT_MB, DB_BLOCK_MB, 'MB', 'db')


def may_read_non_essential(u: dict) -> dict:
    return _decide(u.get('egress_projected_gb'), EGRESS_ALERT_GB, EGRESS_BLOCK_GB, 'GB (projected)', 'egress')


def dispatch_cleanup() -> str:
    """Dispatch the #183 storage cleanup with the job's GITHUB_TOKEN. Never raises."""
    token = (os.environ.get('GITHUB_TOKEN') or '').strip()
    repo = os.environ.get('GITHUB_REPOSITORY') or 'bricksofindia007/bricks-of-india'
    if not token:
        return 'cleanup NOT dispatched: no GITHUB_TOKEN in this environment'
    try:
        import requests
        r = requests.post(
            f'https://api.github.com/repos/{repo}/actions/workflows/{CLEANUP_WORKFLOW}/dispatches',
            headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'},
            json={'ref': 'main'}, timeout=20,
        )
        return f'cleanup dispatched (HTTP {r.status_code})' if r.status_code == 204 else f'cleanup dispatch FAILED (HTTP {r.status_code}: {r.text[:200]})'
    except Exception as exc:  # noqa: BLE001
        return f'cleanup dispatch FAILED ({exc})'


_USAGE_CACHE: dict | None = None


def check_upload(sb, pipeline: str, what: str, alert_fn) -> dict:
    """Evaluate the upload guard once per process (cached). On refusal: alert via
    `alert_fn(subject, body)` (the pipeline's existing sender), dispatch cleanup,
    and raise QuotaBlockedError before any Storage call. Returns the usage dict."""
    global _USAGE_CACHE
    if _USAGE_CACHE is None:
        _USAGE_CACHE = read_usage(sb)
    u = _USAGE_CACHE
    d = may_upload(u)
    tag = ' [SIMULATED READING]' if u.get('simulated') else ''
    print(f"[quota-guard] {pipeline} upload check ({what}): storage={u.get('storage_mb')} MB -> {d['reason']}{tag}")
    if d['allowed']:
        if d['level'] == 'warning':
            print(f"[quota-guard] WARNING {d['detail']}")
        return u
    cleanup = dispatch_cleanup()
    body = (
        f"{pipeline} refused to upload {what} BEFORE touching Storage (FP6.4): {d['detail']}"
        f"{' (' + str(u.get('error')) + ')' if d['reason'] == 'usage-unreadable' else ''}.\n\n"
        f"Storage refuses new media at {STORAGE_BLOCK_MB:.0f} MB of the 1 GB Free-plan quota (alert line {STORAGE_ALERT_MB:.0f} MB); "
        f"the grace period is used up, so going over restricts the whole project immediately.\n\n{cleanup}."
        + ('\n\nThis reading is SIMULATED (BOI_QUOTA_SIMULATE) -- a proof run, not a real breach.' if u.get('simulated') else '')
    )
    try:
        alert_fn(f'🚨 BOI quota guard: {pipeline} upload refused{tag}', body)
    except Exception as exc:  # noqa: BLE001 -- the refusal stands even if the alert fails
        print(f'[quota-guard] alert send failed: {exc}')
    print(f'[quota-guard] REFUSED {pipeline} upload: {d["detail"]}; {cleanup}')
    raise QuotaBlockedError(f"quota_blocked: {d['detail']}")


def reset_cache() -> None:
    global _USAGE_CACHE
    _USAGE_CACHE = None
