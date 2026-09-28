"""
Re-judge queued Quiet Panic scripts with the live, fail-closed coherence judge
(#365 follow-up, P2 Step 8, 27 Sep 2026).

QP #35-#38 were generated while Groq's qwen/qwen3.6-27b was already shut down,
so their stored gate_results.coherence says "SKIPPED: judge call failed (404)"
with pass=true (the old fail-open judge). They must not be grandfathered
through on that pass. For each row id given:
  * only rows still in 'approved' or 'pending_approval' are touched
  * the script is judged with coherence_judge.judge_coherence()
  * gate_results.coherence is replaced by the real result (the old detail is
    kept as previous_detail, plus rejudged_at)
  * pass  -> status unchanged
  * fail or held (no verdict) -> status='publish_blocked', exactly like any
    other gate failure; publishing then needs gate_override + a reason.

Usage: python rejudge_quiet_panic.py [--read-only] <row_id> [<row_id> ...]

--read-only (P6 addendum item 4): judge rows in ANY status (including already
published ones) and print the verdict. Writes NOTHING -- no gate_results, no
status. Used to audit scripts published while the judge failed open.
Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

import requests

from coherence_judge import COHERENCE_JUDGE_MODEL, judge_coherence

ELIGIBLE = {'approved', 'pending_approval'}


def _env(name: str) -> str:
    return (os.environ.get(name) or '').strip().lstrip('﻿')


def main(ids: list[str], read_only: bool = False) -> int:
    url, key = _env('SUPABASE_URL').rstrip('/'), _env('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print('ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set', file=sys.stderr)
        return 1
    h = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
    rc = 0
    for rid in ids:
        r = requests.get(f'{url}/rest/v1/quiet_panic_posts',
                         params={'id': f'eq.{rid}', 'select': 'id,sequence_number,set_number,set_title,status,script,gate_results'},
                         headers=h, timeout=30)
        r.raise_for_status()
        rows = r.json()
        if not rows:
            print(f'{rid}: NOT FOUND'); rc = 1; continue
        row = rows[0]
        tag = f"QP #{row['sequence_number']} {row['set_number']} {row['set_title']}"
        if read_only:
            verdict = judge_coherence(row['script'] or '')
            outcome = 'COHERENT' if verdict['pass'] else ('HELD (no verdict)' if verdict.get('held') else 'INCOHERENT')
            print(f"{tag} [status={row['status']}, READ-ONLY, nothing written]: {outcome} | {verdict['detail'][:300]}")
            continue
        if row['status'] not in ELIGIBLE:
            print(f'{tag}: status={row["status"]} -- not eligible, untouched'); continue
        verdict = judge_coherence(row['script'] or '')
        gates = dict(row.get('gate_results') or {})
        prev = (gates.get('coherence') or {}).get('detail')
        gates['coherence'] = {**verdict, 'model': COHERENCE_JUDGE_MODEL,
                              'rejudged_at': datetime.now(timezone.utc).isoformat(),
                              'previous_detail': prev}
        patch = {'gate_results': gates}
        if verdict['pass'] is not True:
            patch['status'] = 'publish_blocked'
        u = requests.patch(f'{url}/rest/v1/quiet_panic_posts', params={'id': f'eq.{rid}'},
                           headers={**h, 'Prefer': 'return=representation'}, data=json.dumps(patch), timeout=30)
        u.raise_for_status()
        after = u.json()[0]
        outcome = 'PASS (status unchanged)' if verdict['pass'] else ('HELD (no verdict)' if verdict.get('held') else 'FAIL')
        print(f"{tag}: {outcome} -> status={after['status']} | verdict: {verdict['detail'][:200]}")
    return rc


if __name__ == '__main__':
    args = sys.argv[1:]
    ro = '--read-only' in args
    ids = [a for a in args if a != '--read-only']
    if not ids:
        print(__doc__); sys.exit(2)
    sys.exit(main(ids, read_only=ro))
