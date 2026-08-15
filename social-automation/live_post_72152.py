"""
live_post_72152.py — ONE-OFF, single-purpose script for the confirmed
live post of set 72152-1 to YouTube Shorts and Instagram carousel.

Every piece of content below (title, description, caption, image order)
is HARDCODED to the exact text already confirmed in chat -- this script
does NOT call caption_writer.generate_caption() at all, so there is no
possibility of posting a different, freshly-generated version by
accident.

Runs the existing publisher.dry_run() credential check FIRST. If the
Instagram token check fails, the Instagram post is skipped entirely and
reported -- known failure mode from the July 23-25 attempts (expired
token), explicitly checked for, not assumed fixed. YouTube proceeds
independently of Instagram's outcome, matching pipeline.py's own
per-platform independence.

Not wired into any workflow or schedule. Run once, by hand, via
workflow_dispatch, for this one post only.
"""

import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

import db
import publisher

SET_NUM = '72152-1'

# ── Hardcoded, already-confirmed content -- no generation happens here ──
YT_TITLE = 'Pikachu and Poké Ball (72152-1) | #LEGO #Shorts'
YT_DESCRIPTION = (
    "Another EMI looms. Another cricket match is won, or lost. And then, "
    "there's this. Pikachu. In LEGO. Your wallet is already sweating. "
    "For 2050 pieces of pure nostalgia, the global price is a rather "
    "reasonable $199.99. Translated into Indian Rupees, with a touch of "
    "our special currency converter magic, we're looking at roughly "
    "₹22,679. A serious investment for a pocket monster. But then, who "
    "needs a new pair of slippers when you can have a giant, buildable "
    "Pikachu?\n\n"
    "🧱 Follow Bricks of India for LEGO news, prices & deals in India. "
    "Link in bio. #LEGOIndia #BricksofIndia\n\n"
    "📍 Bricks of India — India's only LEGO price tracker\n"
    "🔗 bricksofindia.com\n\n"
    "#LEGO #LEGOIndia #LEGOSets #BricksofIndia #Shorts #LEGOShorts"
)

IG_CAPTION = (
    "Another day, another rupee agonising over what to buy. This time, "
    "it's not a second-hand Maruti, but a pocket-monster made of "
    "plastic. The Pikachu and Poké Ball set, all 2,050 pieces of it, is "
    "officially a thing. For the discerning collector with a wallet "
    "that laughs in the face of EMIs, the global price tag is a modest "
    "$199.99. Here in India, after the usual conversion gymnastics and "
    "a small \"import duty surcharge\" that inexplicably appears, "
    "you're looking at a cool ₹22,679. That's a lot of samosas, my "
    "friends. A lot.\n\n"
    "🧱 Follow Bricks of India for LEGO news, prices & deals in India. "
    "Link in bio. #LEGOIndia #BricksofIndia"
)


def _existing_image_urls() -> list[str]:
    client = db._client()
    return [
        client.storage.from_(db.BUCKET_NAME).get_public_url(f'{SET_NUM}_feed_{i}.jpg')
        for i in range(1, 11)
    ]


def _existing_shorts_url() -> str:
    client = db._client()
    return client.storage.from_(db.BUCKET_NAME).get_public_url(f'{SET_NUM}_shorts.mp4')


def main() -> None:
    print(f'[live-post] Target: {SET_NUM}\n')

    # ── Step 0: credential check, real and read-only ────────────────────
    print('=' * 60)
    print('CREDENTIAL CHECK (publisher.dry_run logic, inline)')
    print('=' * 60)

    ig_ok = False
    yt_ok = False

    if not publisher.IG_ACCESS_TOKEN or not publisher.IG_USER_ID:
        print('[ig-check] IG_ACCESS_TOKEN or IG_USER_ID not set.')
    else:
        import requests
        resp = requests.get(
            f'{publisher.GRAPH_API_BASE}/{publisher.IG_USER_ID}',
            params={'fields': 'id,username', 'access_token': publisher.IG_ACCESS_TOKEN},
            timeout=10,
        )
        data = resp.json()
        if 'error' in data:
            print(f'[ig-check] TOKEN INVALID: {data["error"].get("message")}')
        else:
            print(f'[ig-check] OK: @{data.get("username")} (ID: {data.get("id")})')
            ig_ok = True

    creds = publisher._load_youtube_credentials()
    if creds is None:
        print('[yt-check] YouTube credentials could not be loaded.')
    elif creds.valid:
        print('[yt-check] OK: token valid.')
        yt_ok = True
    elif creds.expired:
        print('[yt-check] Token expired but refresh_token present -- publisher will auto-refresh on use.')
        yt_ok = True
    else:
        print('[yt-check] Token in an unexpected state.')

    print()

    # ── Step 1: YouTube ───────────────────────────────────────────────────
    print('=' * 60)
    print('YOUTUBE')
    print('=' * 60)
    if not yt_ok:
        print('[yt] SKIPPED — credential check did not pass. Not attempting post_youtube_shorts().')
    else:
        import tempfile
        import requests as req
        shorts_url = _existing_shorts_url()
        print(f'[yt] Downloading {shorts_url} ...')
        resp = req.get(shorts_url, timeout=120)
        resp.raise_for_status()
        tmp = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
        tmp.write(resp.content)
        tmp.close()
        print(f'[yt] Downloaded {len(resp.content)/1024/1024:.1f} MB to {tmp.name}')

        set_data = {'set_num': SET_NUM, 'name': 'Pikachu and Poké Ball'}
        try:
            # post_youtube_shorts() builds title/description internally from
            # set_data + caption_text -- reproduce EXACTLY here by passing
            # caption_text such that its construction matches YT_DESCRIPTION
            # exactly is fragile; instead call the Graph/YouTube API steps
            # publisher.post_youtube_shorts() itself performs, but with our
            # hardcoded title/description directly, so the confirmed text is
            # guaranteed byte-for-byte, not reconstructed.
            from googleapiclient.discovery import build
            from googleapiclient.http import MediaFileUpload

            youtube = build('youtube', 'v3', credentials=creds)
            channel_response = youtube.channels().list(part='snippet', mine=True).execute()
            if not channel_response.get('items'):
                raise SystemExit('[yt] No YouTube channel found for authenticated user. Aborting.')
            channel_title = channel_response['items'][0]['snippet']['title']
            channel_id = channel_response['items'][0]['id']
            print(f'[yt] Authenticated channel: {channel_title} ({channel_id})')
            if channel_title != 'Bricks of India':
                raise SystemExit(f"[yt] WRONG CHANNEL: {channel_title}. Aborting.")

            print(f'[yt] Uploading with confirmed title/description...')
            request = youtube.videos().insert(
                part='snippet,status',
                body={
                    'snippet': {
                        'title': YT_TITLE,
                        'description': YT_DESCRIPTION,
                        'tags': ['LEGO', 'LEGOIndia', 'LEGOSets', 'BricksofIndia', 'Shorts', 'LEGOShorts'],
                        'categoryId': '24',
                    },
                    'status': {'privacyStatus': 'public'},
                },
                media_body=MediaFileUpload(tmp.name, mimetype='video/mp4', resumable=True),
            )
            response = request.execute()
            yt_video_id = response['id']
            print(f'[yt] SUCCESS. Video ID: {yt_video_id}')
            print(f'[yt] URL: https://youtube.com/shorts/{yt_video_id}')

            # ── Real confirmation, not just absence of exception ──
            confirm = youtube.videos().list(part='snippet,status', id=yt_video_id).execute()
            confirm_items = confirm.get('items', [])
            if not confirm_items:
                print(f'[yt] WARNING: insert() returned an ID but videos().list() found no matching video. NOT marking posted_sets.')
            else:
                real_title = confirm_items[0]['snippet']['title']
                real_status = confirm_items[0]['status']['uploadStatus']
                print(f'[yt] CONFIRMED via videos().list(): title={real_title!r}, uploadStatus={real_status}')
                client = db._client()
                client.table('posted_sets').update({'yt_shorts_posted': True}).eq('id', 60).execute()
                print(f'[yt] posted_sets id=60 updated: yt_shorts_posted=true')
        except Exception as exc:
            print(f'[yt] FAILED: {exc}')
        finally:
            try:
                Path(tmp.name).unlink(missing_ok=True)
            except Exception:
                pass

    print()

    # ── Step 2: Instagram ─────────────────────────────────────────────────
    print('=' * 60)
    print('INSTAGRAM')
    print('=' * 60)
    if not ig_ok:
        print('[ig] SKIPPED — token check did not pass. Not attempting post_instagram_carousel().')
        print('[ig] Known failure mode from July 23-25: expired access token. Re-check/refresh the token before retrying.')
    else:
        image_urls = _existing_image_urls()
        print(f'[ig] {len(image_urls)} image URLs confirmed for posting.')
        try:
            media_id = publisher.post_instagram_carousel(image_urls, IG_CAPTION)
            print(f'[ig] SUCCESS. Media ID: {media_id}')

            # ── Real confirmation via a GET on the returned media ID ──
            import requests as req
            confirm_resp = req.get(
                f'{publisher.GRAPH_API_BASE}/{media_id}',
                params={'fields': 'id,permalink,media_type,timestamp', 'access_token': publisher.IG_ACCESS_TOKEN},
                timeout=15,
            )
            confirm_data = confirm_resp.json()
            if 'error' in confirm_data:
                print(f'[ig] WARNING: publish returned {media_id} but confirmation GET failed: {confirm_data["error"]}. NOT marking posted_sets.')
            else:
                print(f'[ig] CONFIRMED: {confirm_data}')
                client = db._client()
                client.table('posted_sets').update({'ig_feed_posted': True}).eq('id', 60).execute()
                print(f'[ig] posted_sets id=60 updated: ig_feed_posted=true')
        except Exception as exc:
            print(f'[ig] FAILED: {exc}')

    print()
    print('=' * 60)
    print('DONE')
    print('=' * 60)


if __name__ == '__main__':
    main()
