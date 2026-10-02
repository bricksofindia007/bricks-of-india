"""
post_prepared.py: post ONE pre-approved campaign piece (round 10b, Brick Rush), exactly as approved.
Nothing is generated here: the media URLs and the captions come from a committed manifest
(social-automation/campaigns/<campaign>.json), reviewed by chat and approved by Abhinav in chat.

  python post_prepared.py --manifest campaigns/brick-rush-2026.json --day day1 --piece carousel
  python post_prepared.py --manifest campaigns/brick-rush-2026.json --day day1 --piece short

carousel -> Instagram carousel (max 10 items, Meta's limit)
short    -> Instagram Reel + YouTube Short (title/description from the manifest)
After a successful post it records the day in posted_sets (set_num 'campaign:<id>') so the
regular one-post-a-day check sees today's slot as used.
YouTube pinned comments can't be pinned through the API: the comment is posted and must be
pinned by hand in YouTube Studio (printed at the end).
"""
import argparse
import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
import publisher  # noqa: E402

BANNED = ['affiliate', 'commission', 'everything', 'no usage limits', 'online today', "today's prices",
          'on 2 oct', 'online on', 'lego.in had', 'cheaper online', 'facebook']


def check_copy(*texts):
    for t in texts:
        hits = [w for w in BANNED if w in (t or '').lower()]
        if hits:
            raise SystemExit(f'Refusing to post: banned wording {hits}')


def record(campaign_id: str, label: str, platforms: dict) -> None:
    try:
        import db
        db._client().table('posted_sets').insert({
            'set_num': f'campaign:{campaign_id}', 'set_name': label,
            'posted_at': datetime.now(timezone.utc).isoformat(),
            'ig_feed_posted': platforms.get('ig_feed', False), 'ig_reels_posted': platforms.get('ig_reels', False),
            'yt_shorts_posted': platforms.get('yt_shorts', False),
        }).execute()
    except Exception as e:  # recording is bookkeeping; the post itself already happened
        print(f'[post_prepared] WARN: could not record posted_sets row: {e}')


def youtube_upload(video_url: str, title: str, description: str, comment: str | None) -> str:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    creds = publisher._load_youtube_credentials()
    yt = build('youtube', 'v3', credentials=creds)
    ch = yt.channels().list(part='snippet', mine=True).execute()['items'][0]
    if ch['snippet']['title'] != 'Bricks of India':
        raise SystemExit(f"[guard] WRONG CHANNEL: {ch['snippet']['title']}. Aborting.")
    tmp = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
    tmp.write(requests.get(video_url, timeout=120).content); tmp.close()
    resp = yt.videos().insert(part='snippet,status', body={
        'snippet': {'title': title[:100], 'description': description[:4900],
                    'tags': ['LEGO', 'LEGOIndia', 'BrickRush', 'BricksofIndia', 'Shorts'], 'categoryId': '24'},
        'status': {'privacyStatus': 'public', 'selfDeclaredMadeForKids': False},
    }, media_body=MediaFileUpload(tmp.name, mimetype='video/mp4', resumable=True)).execute()
    vid = resp['id']
    print(f'[post_prepared] YouTube Short: https://youtube.com/shorts/{vid}')
    if comment:
        yt.commentThreads().insert(part='snippet', body={'snippet': {'videoId': vid, 'topLevelComment': {'snippet': {'textOriginal': comment}}}}).execute()
        print('[post_prepared] Comment posted. PIN IT BY HAND in YouTube Studio (the API cannot pin):', comment)
    return vid


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', required=True); ap.add_argument('--day', required=True)
    ap.add_argument('--piece', choices=['carousel', 'short'], required=True)
    a = ap.parse_args()
    m = json.loads((Path(__file__).parent / a.manifest).read_text(encoding='utf-8'))
    item = m['days'][a.day][a.piece]
    if not item.get('approved'):
        raise SystemExit(f'Refusing to post: {a.day}/{a.piece} is not marked approved in the manifest')
    cid = f"{m['id']}:{a.day}:{a.piece}"
    if a.piece == 'carousel':
        check_copy(item['caption'])
        if not 2 <= len(item['images']) <= 10:
            raise SystemExit(f"Refusing: carousel needs 2-10 images, got {len(item['images'])}")
        media = publisher.post_instagram_carousel(item['images'], item['caption'])
        print(f'[post_prepared] Instagram carousel posted: {media}')
        record(cid, item.get('label', cid), {'ig_feed': True})
    else:
        check_copy(item['ig_caption'], item['yt_title'], item['yt_description'], item.get('pinned_comment'))
        platforms = {}
        media = publisher.post_instagram_reels(item['video'], item['ig_caption'])
        print(f'[post_prepared] Instagram Reel posted: {media}'); platforms['ig_reels'] = True
        youtube_upload(item['video'], item['yt_title'], item['yt_description'], item.get('pinned_comment'))
        platforms['yt_shorts'] = True
        record(cid, item.get('label', cid), platforms)


if __name__ == '__main__':
    main()
