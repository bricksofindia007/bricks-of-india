#!/usr/bin/env python3
"""Daily check of this repo's own Instagram token (IG_ACCESS_TOKEN).

Reads days left from Meta's debug_token (the token's own expiry). Emails only
when the token is rejected or under 10 days from expiry. No refresh here: the
rotation stays in ig-token-refresh.yml. No token value is printed or emailed.

Env: IG_ACCESS_TOKEN, FB_APP_ID, FB_APP_SECRET, RESEND_API_KEY (all existing).
"""
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

ALERT_BELOW_DAYS = 10
ALERT_TO = "abhinav@bricksofindia.com"
ALERT_FROM = "BOI Alerts <alerts@bricksofindia.com>"


def strip(name):
    return os.environ.get(name, "").lstrip("﻿").strip()


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


def should_alert(days):
    return days is None or days < ALERT_BELOW_DAYS


def describe(days):
    if days is None:
        return "token is not valid"
    if days == float("inf"):
        return "token does not expire"
    return f"{days:.0f} days left"


def send(subject, text):
    import resend  # installed by the workflow step
    resend.api_key = strip("RESEND_API_KEY")
    resend.Emails.send({"from": ALERT_FROM, "to": [ALERT_TO], "subject": subject,
                        "html": f"<p>{text}</p>"})


def main():
    token, app_id, app_secret = strip("IG_ACCESS_TOKEN"), strip("FB_APP_ID"), strip("FB_APP_SECRET")
    if not (token and app_id and app_secret):
        print("setup: IG_ACCESS_TOKEN, FB_APP_ID or FB_APP_SECRET not set")
        sys.exit(1)
    now = dt.datetime.now(dt.timezone.utc)
    days = days_left(debug_token(token, app_id, app_secret), now)
    print(f"main-repo Instagram token: {describe(days)}")
    if should_alert(days):
        send("[BOI] Main-repo Instagram token needs attention",
             f"The main-repo Instagram token: {describe(days)}. The rotation job runs twice a month; check it if this repeats.")
        sys.exit(1 if days is None else 0)


if __name__ == "__main__":
    main()
