"""
ONE-OFF DIAGNOSTIC -- not part of the regular canary. Fires one real,
precisely-timestamped Gemini call per key (GEMINI_API_KEY, article
pipeline; GEMINI_SOCIAL_API_KEY, video pipelines) so Abhinav can correlate
the two exact UTC timestamps against AI Studio's own Usage page and see
which project each secret's traffic actually lands in. GitHub Secrets are
write-only -- this can't be resolved by reading the secret values back and
comparing them to the console.

Imports the real, unmodified check_gemini() from model_canary.py rather
than reimplementing the call -- this is the exact same function the daily
canary uses, just wrapped here with explicit before/after timestamp
capture (the canary's own main() evaluates all 4 checks into a list
before printing anything, so its normal log output can't be used to
recover individual call timestamps).

Meant to run exactly once, in GitHub Actions (where the real secrets
exist), then be deleted -- not a permanent addition.
"""
import sys
from datetime import datetime, timezone

from model_canary import check_gemini

print('=== Gemini key -> AI Studio project timestamp probe ===')
print()

t0 = datetime.now(timezone.utc).isoformat()
r1 = check_gemini('article pipeline (GEMINI_API_KEY)', 'GEMINI_API_KEY', 'gemini-2.5-flash-lite')
t1 = datetime.now(timezone.utc).isoformat()
print(f'GEMINI_API_KEY call fired at {t0}, completed at {t1}')
print(f'  result: ok={r1.ok} detail={r1.detail}')
print()

t2 = datetime.now(timezone.utc).isoformat()
r2 = check_gemini('video pipelines (GEMINI_SOCIAL_API_KEY)', 'GEMINI_SOCIAL_API_KEY', 'gemini-2.5-flash')
t3 = datetime.now(timezone.utc).isoformat()
print(f'GEMINI_SOCIAL_API_KEY call fired at {t2}, completed at {t3}')
print(f'  result: ok={r2.ok} detail={r2.detail}')
print()

print('=== SUMMARY (check these two exact timestamps against AI Studio\'s Usage page) ===')
print(f'GEMINI_API_KEY        -> fired {t0}')
print(f'GEMINI_SOCIAL_API_KEY -> fired {t2}')

if not (r1.ok and r2.ok):
    sys.exit(1)
