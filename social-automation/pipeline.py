"""
pipeline.py — Master orchestrator for the BOI Social Automation Pipeline.

Execution order:
  scraper → 10 product images → reels video → shorts video (with text overlays) →
  storage upload → caption → IG carousel (8 imgs) → IG reels →
  YouTube Shorts → mark posted → notify success → cleanup tmp/
"""

import sys
import traceback
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

import scraper
import media_processor
import caption_writer
import publisher
import db
import notifier


def _cleanup(paths: list) -> None:
    """Delete local tmp files. Errors are logged but not fatal."""
    for p in paths:
        try:
            Path(p).unlink(missing_ok=True)
        except Exception as exc:
            print(f'[pipeline] cleanup warning: {exc}')


def main() -> None:
    # ── Step 1: Find a new set ────────────────────────────────────────────────
    print('[pipeline] Step 1: Looking for a new set...')
    set_data = scraper.get_new_set()

    if set_data is None:
        print('[pipeline] No new sets found today. Exiting cleanly.')
        db.record_heartbeat('instagram', success=None, error='no_eligible_candidates')
        db.record_heartbeat('youtube',   success=None, error='no_eligible_candidates')
        sys.exit(0)

    set_num = set_data['set_num']
    print(f'[pipeline] Proceeding with: {set_num} - {set_data["name"]}')
    print(f'[pipeline]   Parts: {set_data.get("num_parts", "?")}  '
          f'Gallery: {len(set_data.get("gallery_images", []))} images  '
          f'Source: {set_data.get("source", "?")}')

    # ── Step 2: Generate 10 product images ───────────────────────────────────
    print('[pipeline] Step 2: Generating 10 product images (9 gallery + stats card)...')
    all_paths = media_processor.process_carousel_images(set_data)

    # ── Step 3: Generate videos ───────────────────────────────────────────────
    print('[pipeline] Step 3a: Generating 8s Instagram Reels video...')
    reels_path = media_processor.process_reels_video(set_data, all_paths)

    print('[pipeline] Step 3b: Generating 45s YouTube Shorts video with text overlays...')
    shorts_path = media_processor.process_shorts_video(set_data, all_paths)

    # ── Step 4: Upload to Supabase Storage ───────────────────────────────────
    print('[pipeline] Step 4: Uploading 10 product images to storage...')
    image_urls = db.upload_many_to_storage(
        [(p, f'{set_num}_feed_{i + 1}.jpg') for i, p in enumerate(all_paths)]
    )

    print('[pipeline] Step 5a: Uploading Reels video to storage...')
    reels_url = db.upload_to_storage(reels_path, f'{set_num}_reels.mp4')

    print('[pipeline] Step 5b: Uploading Shorts video to storage...')
    db.upload_to_storage(shorts_path, f'{set_num}_shorts.mp4')

    # ── Step 5: Generate caption ──────────────────────────────────────────────
    print('[pipeline] Step 6: Generating caption...')
    caption_text = caption_writer.generate_caption(set_data)
    print(f'[pipeline] Caption preview (first 120 chars): {caption_text[:120]}...')

    # ── Step 6: Publish ───────────────────────────────────────────────────────
    platforms = {'ig_feed': False, 'ig_reels': False, 'yt_shorts': False}

    # IG carousel: 7 gallery images + stats card = 8 total (Meta allows up to 10)
    carousel_urls = image_urls[:7] + [image_urls[-1]]
    print(f'[pipeline] Step 7: Posting to Instagram carousel ({len(carousel_urls)} images)...')
    publisher.post_instagram_carousel(carousel_urls, caption_text)
    platforms['ig_feed'] = True

    print('[pipeline] Step 8: Posting to Instagram Reels...')
    publisher.post_instagram_reels(reels_url, caption_text)
    platforms['ig_reels'] = True
    db.record_heartbeat('instagram', success=True)

    print('[pipeline] Step 9: Uploading YouTube Short...')
    yt_failure_reason = None
    try:
        yt_id = publisher.post_youtube_shorts(shorts_path, set_data, caption_text)
        if yt_id is not None:
            platforms['yt_shorts'] = True
            db.record_heartbeat('youtube', success=True)
        else:
            yt_failure_reason = 'token invalid or absent'
            db.record_heartbeat('youtube', success=False, error=yt_failure_reason)
    except Exception as yt_exc:
        yt_failure_reason = str(yt_exc)
        print(f'[pipeline] YouTube upload failed: {yt_exc}')
        platforms['yt_shorts'] = False
        db.record_heartbeat('youtube', success=False, error=yt_failure_reason)

    # ── Step 7: Record in Supabase ────────────────────────────────────────────
    print('[pipeline] Step 10: Recording in posted_sets...')
    db.mark_as_posted(set_num, set_data.get('name', ''), platforms)

    # ── Step 8: Clean up tmp/ ─────────────────────────────────────────────────
    print('[pipeline] Step 11: Cleaning up tmp/ files...')
    _cleanup(all_paths + [reels_path, shorts_path])

    # ── Step 9: Notify success ────────────────────────────────────────────────
    print('[pipeline] Step 12: Sending success email...')
    notifier.send_success(set_data, platforms)

    print(f'\n[pipeline] Done. {set_num} posted successfully.')
    print(f'  IG Feed:  {"OK" if platforms["ig_feed"] else "X"}')
    print(f'  IG Reels: {"OK" if platforms["ig_reels"] else "X"}')
    print(f'  YouTube:  {"OK" if platforms["yt_shorts"] else "FAIL — " + (yt_failure_reason or "unknown")}')

    if yt_failure_reason:
        print(f'[pipeline] Exiting non-zero: YouTube failed — {yt_failure_reason}')
        sys.exit(1)


if __name__ == '__main__':
    current_module = 'pipeline'
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        tb_str = traceback.format_exc()
        print(f'\n[pipeline] FATAL ERROR:\n{tb_str}')
        notifier.send_failure(exc, tb_str, current_module)
        sys.exit(1)
