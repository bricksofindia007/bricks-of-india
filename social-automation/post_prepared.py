"""
post_prepared.py: post ONE pre-approved campaign piece (round 10b, Brick Rush), exactly as approved.
Nothing is generated here: the media URLs and the captions come from a committed manifest
(social-automation/campaigns/<campaign>.json), reviewed by chat and approved by Abhinav in chat.

  python post_prepared.py --manifest campaigns/brick-rush-2026.json --day day1 --piece carousel
  python post_prepared.py --manifest campaigns/brick-rush-2026.json --day day1 --piece short

carousel -> Instagram carousel (max 10 items, Meta's limit)
short    -> Instagram Reel + YouTube Short (title/description from the manifest)
Idempotent per platform: each success is recorded at once in posted_sets
(set_num 'campaign:<id>:<day>:<piece>:<platform>'); a re-run skips platforms already done.
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


PLATFORM_FLAG = {'ig_feed': 'ig_feed_posted', 'ig_reels': 'ig_reels_posted', 'yt_shorts': 'yt_shorts_posted'}


def _key(piece_id: str, platform: str) -> str:
    return f'campaign:{piece_id}:{platform}'


def already_posted(piece_id: str, platform: str) -> bool:
    """Idempotency (round 10c): one posted_sets row per piece per platform."""
    import db
    rows = db._client().table('posted_sets').select('id').eq('set_num', _key(piece_id, platform)).limit(1).execute().data
    return bool(rows)


def record(piece_id: str, label: str, platform: str) -> None:
    """Written immediately after each platform succeeds, so a re-run skips it."""
    import db
    row = {'set_num': _key(piece_id, platform), 'set_name': label, 'posted_at': datetime.now(timezone.utc).isoformat(),
           'ig_feed_posted': False, 'ig_reels_posted': False, 'yt_shorts_posted': False}
    row[PLATFORM_FLAG[platform]] = True
    db._client().table('posted_sets').insert(row).execute()
    print(f'[post_prepared] recorded {platform} for {piece_id}')


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
    label = item.get('label', cid)

    def once(platform, post):
        if already_posted(cid, platform):
            print(f'[post_prepared] {platform}: already posted for {cid}, skipping')
            return
        post()
        record(cid, label, platform)

    if a.piece == 'carousel':
        check_copy(item['caption'])
        if not 2 <= len(item['images']) <= 10:
            raise SystemExit(f"Refusing: carousel needs 2-10 images, got {len(item['images'])}")
        once('ig_feed', lambda: print('[post_prepared] Instagram carousel posted:',
                                       publisher.post_instagram_carousel(item['images'], item['caption'])))
    else:
        check_copy(item['ig_caption'], item['yt_title'], item['yt_description'], item.get('pinned_comment'))
        once('ig_reels', lambda: print('[post_prepared] Instagram Reel posted:',
                                        publisher.post_instagram_reels(item['video'], item['ig_caption'])))
        once('yt_shorts', lambda: youtube_upload(item['video'], item['yt_title'], item['yt_description'], item.get('pinned_comment')))

if __name__ == '__main__':
    main()
