"""Read-only: lists the newest Instagram media (time, type, permalink, first caption words). Posts nothing, prints no token."""
import os
import requests

r = requests.get(
    f"https://graph.facebook.com/v21.0/{os.environ['IG_USER_ID']}/media",
    params={'fields': 'timestamp,media_product_type,media_type,permalink,caption', 'limit': 12,
            'access_token': os.environ['IG_ACCESS_TOKEN']},
    timeout=30,
)
print('media HTTP', r.status_code)
j = r.json()
if 'error' in j:
    print('error:', j['error'].get('message', '')[:200])
for m in j.get('data', []):
    cap = (m.get('caption') or '').replace('\n', ' ')[:70]
    print(f"  {m['timestamp']} | {m.get('media_product_type')}/{m.get('media_type')} | {m.get('permalink')} | {cap}")
