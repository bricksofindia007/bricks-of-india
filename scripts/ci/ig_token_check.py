#!/usr/bin/env python3
"""Daily check of this repo's own Instagram token (IG_ACCESS_TOKEN).

Reads days left from Meta's debug_token (the token's own expiry). The job fails
(non-zero exit) when the token is rejected, when fewer than 10 days are left, or
when the check cannot run. A failure is reported only by the failed workflow run.
No notification is sent from this script. No refresh here: rotation stays in
ig-token-refresh.yml. No token value is printed.

Every run records one line in the IG_TOKEN_CHECK_HEARTBEAT repo variable:
"<UTC time>|<ok or failed>|<reason>". Needs GH_TOKEN with variables write.

Env: IG_ACCESS_TOKEN, FB_APP_ID, FB_APP_SECRET (existing); GH_TOKEN, GITHUB_REPOSITORY for the heartbeat.
"""
import datetime as dt
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ALERT_BELOW_DAYS = 10
HEARTBEAT_VAR = "IG_TOKEN_CHECK_HEARTBEAT"
BOM = "﻿"


def strip(name):
    return os.environ.get(name, "").lstrip(BOM).strip()


def debug_token(token, app_id, app_secret):
    """Meta's debug_token data block, or {} if the call itself fails."""
    url = "https://graph.facebook.com/debug_token?" + urllib.parse.urlencode(
        {"input_token": token, "access_token": f"{app_id}|{app_secret}"})
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return json.loads(resp.read().decode()).get("data", {})
    except urllib.error.HTTPError:
        return {}


def days_left(data, now):
    """None if the token is not valid; a float otherwise (inf if it never expires)."""
    if not data.get("is_valid"):
        return None
    expires_at = int(data.get("expires_at") or 0)
    if expires_at == 0:
        return float("inf")
    return (dt.datetime.fromtimestamp(expires_at, dt.timezone.utc) - now).total_seconds() / 86400


def is_failure(days):
    """A failure: the token is not valid, or fewer than ALERT_BELOW_DAYS are left."""
    return days is None or days < ALERT_BELOW_DAYS


def describe(days):
    if days is None:
        return "token is not valid"
    if days == float("inf"):
        return "token does not expire"
    return f"{days:.0f} days left"


def write_heartbeat(now, ok, reason, run=subprocess.run):
    """Writes the heartbeat variable. Returns True on success. A failed write fails the job."""
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    value = f"{now.strftime('%Y-%m-%dT%H:%M:%SZ')}|{'ok' if ok else 'failed'}|{reason}"
    try:
        run(["gh", "variable", "set", HEARTBEAT_VAR, "--repo", repo, "--body", value],
            check=True, capture_output=True, text=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        print(f"heartbeat not written: {type(exc).__name__}")
        return False


def main(env_check=strip, fetch=debug_token, heartbeat=write_heartbeat, now_fn=None):
    now = (now_fn or (lambda: dt.datetime.now(dt.timezone.utc)))()
    token, app_id, app_secret = env_check("IG_ACCESS_TOKEN"), env_check("FB_APP_ID"), env_check("FB_APP_SECRET")
    if not (token and app_id and app_secret):
        heartbeat(now, False, "setup: a required secret is not set")
        print("setup: IG_ACCESS_TOKEN, FB_APP_ID or FB_APP_SECRET not set")
        return 1
    days = days_left(fetch(token, app_id, app_secret), now)
    print(f"main-repo Instagram token: {describe(days)}")
    failed = is_failure(days)
    wrote = heartbeat(now, not failed, describe(days))
    if failed:
        print("check failed: the token needs attention; the failed run is the notice")
        return 1
    return 0 if wrote else 1


if __name__ == "__main__":
    sys.exit(main())
