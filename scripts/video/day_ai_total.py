"""Writes the day's AI rupee total for the coherence judge's cap (option B, Chat 23:50 IST).

Reads today's rows (UTC day, the same day key the TypeScript guard uses) from the usage table with the
service key the video job already holds, sums the rupees, and appends BOI_AI_DAY_RUPEES to GITHUB_ENV.
On any error it writes nothing and exits 0: the judge then runs without the cap line and logs nothing extra.
No value is printed. Only the total is written.
"""
import datetime
import json
import os
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main() -> int:
    try:
        from secrets_util import get_secret
        url = (get_secret('SUPABASE_URL') or os.environ.get('SUPABASE_URL', '')).rstrip('/')
        key = get_secret('SUPABASE_SERVICE_ROLE_KEY')
        if not url or not key:
            print('day AI total: database settings not present; the judge runs without the cap line')
            return 0
        day = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
        q = urllib.parse.urlencode({'day': f'eq.{day}', 'select': 'rupees'})
        req = urllib.request.Request(f'{url}/rest/v1/ai_model_usage?{q}',
                                     headers={'apikey': key, 'Authorization': f'Bearer {key}'})
        with urllib.request.urlopen(req, timeout=20) as r:
            rows = json.loads(r.read().decode('utf-8'))
        total = sum(float(x.get('rupees') or 0) for x in rows)
        env_file = os.environ.get('GITHUB_ENV')
        if env_file:
            with open(env_file, 'a', encoding='utf-8') as f:
                f.write(f'BOI_AI_DAY_RUPEES={total:.2f}\n')
        print(f'day AI total read for the judge cap ({len(rows)} rows)')
        return 0
    except Exception as e:
        print(f'day AI total not read ({type(e).__name__}); the judge runs without the cap line')
        return 0


if __name__ == '__main__':
    raise SystemExit(main())
