"""
pipeline.py — Master orchestrator for the BOI Social Automation Pipeline.

Execution order:
  scraper → media (image + video) → storage upload → caption →
  IG feed → IG reels → YouTube Shorts → mark posted → notify success

Any unhandled exception triggers a failure email and exits with code 1.
"""

import sys
import traceback
from dotenv import load_dotenv

load_dotenv()

import scraper
import media_processor
import caption_writer
import publisher
import db
import notifier


def main() -> None:
    # ── Step 1: Find a new set ────────────────────────────────────────────────
    print('[pipeline] Step 1: Looking for a new set...')
    set_data = scraper.get_new_set()

    if set_data is None:
        print('[pipeline] No new sets found today. Exiting cleanly.')
        sys.exit(0)

    set_num = set_data['set_num']
    print(f'[pipeline] Proceeding with: {set_num} - {set_data["name"]}')

    # ── Step 2: Generate media ────────────────────────────────────────────────
    print('[pipeline] Step 2: Processing image...')
    image_path = media_processor.process_image(set_data)

    print('[pipeline] Step 3: Processing video...')
    video_path = media_processor.process_video(set_data, image_path)

    # ── Step 3: Upload to Supabase Storage ───────────────────────────────────
    print('[pipeline] Step 4: Uploading image to storage...')
    image_url = db.upload_to_storage(image_path, f'{set_num}_feed.jpg')

    print('[pipeline] Step 5: Uploading video to storage...')
    video_url = db.upload_to_storage(video_path, f'{set_num}_reels.mp4')

    # ── Step 4: Generate caption ──────────────────────────────────────────────
    print('[pipeline] Step 6: Generating caption...')
    caption_text = caption_writer.generate_caption(set_data)
    print(f'[pipeline] Caption preview (first 120 chars): {caption_text[:120]}...')

    # ── Step 5: Publish ───────────────────────────────────────────────────────
    platforms = {'ig_feed': False, 'ig_reels': False, 'yt_shorts': False}

    print('[pipeline] Step 7: Posting to Instagram Feed...')
    publisher.post_instagram_feed(image_url, caption_text)
    platforms['ig_feed'] = True

    print('[pipeline] Step 8: Posting to Instagram Reels...')
    publisher.post_instagram_reels(video_url, caption_text)
    platforms['ig_reels'] = True

    print('[pipeline] Step 9: Uploading YouTube Short...')
    yt_id = publisher.post_youtube_shorts(video_path, set_data, caption_text)
    platforms['yt_shorts'] = yt_id is not None

    # ── Step 6: Record in Supabase ────────────────────────────────────────────
    print('[pipeline] Step 10: Recording in posted_sets...')
    db.mark_as_posted(set_num, set_data.get('name', ''), platforms)

    # ── Step 7: Notify success ────────────────────────────────────────────────
    print('[pipeline] Step 11: Sending success email...')
    notifier.send_success(set_data, platforms)

    print(f'\n[pipeline] Done. {set_num} posted successfully.')
    print(f'  IG Feed:  {"OK" if platforms["ig_feed"] else "X"}')
    print(f'  IG Reels: {"OK" if platforms["ig_reels"] else "X"}')
    print(f'  YouTube:  {"OK" if platforms["yt_shorts"] else "skipped (no token)"}')


if __name__ == '__main__':
    current_module = 'pipeline'
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        tb_str = traceback.format_exc()
        print(f'\n[pipeline] FATAL ERROR:\n{tb_str}', file=sys.stderr)
        notifier.send_failure(exc, tb_str, current_module)
        sys.exit(1)
