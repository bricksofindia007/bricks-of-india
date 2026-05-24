"""
pipeline.py — Master orchestrator for the BOI Social Automation Pipeline.

Execution order:
  scraper → 10 product images → reels video →
  storage upload → caption → IG carousel (8 imgs) → IG reels →
  mark posted → notify success → cleanup tmp/

YouTube is disabled: communityPosts.insert does not exist in YouTube Data API v3.
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
        sys.exit(0)

    set_num = set_data['set_num']
    print(f'[pipeline] Proceeding with: {set_num} - {set_data["name"]}')
    print(f'[pipeline]   Parts: {set_data.get("num_parts", "?")}  '
          f'Gallery: {len(set_data.get("gallery_images", []))} images  '
          f'Source: {set_data.get("source", "?")}')

    # ── Step 2: Generate 10 product images ───────────────────────────────────
    print('[pipeline] Step 2: Generating 10 product images (9 gallery + stats card)...')
    all_paths = media_processor.process_carousel_images(set_data)

    # ── Step 3: Generate Reels video ─────────────────────────────────────────
    print('[pipeline] Step 3: Generating 8s Instagram Reels video...')
    reels_path = media_processor.process_reels_video(set_data, all_paths)

    # ── Step 4: Upload to Supabase Storage ───────────────────────────────────
    print('[pipeline] Step 4: Uploading 10 product images to storage...')
    image_urls = db.upload_many_to_storage(
        [(p, f'{set_num}_feed_{i + 1}.jpg') for i, p in enumerate(all_paths)]
    )

    print('[pipeline] Step 5: Uploading Reels video to storage...')
    reels_url = db.upload_to_storage(reels_path, f'{set_num}_reels.mp4')

    # ── Step 5: Generate caption ──────────────────────────────────────────────
    print('[pipeline] Step 6: Generating caption...')
    caption_text = caption_writer.generate_caption(set_data)
    print(f'[pipeline] Caption preview (first 120 chars): {caption_text[:120]}...')

    # ── Step 6: Publish ───────────────────────────────────────────────────────
    platforms = {'ig_feed': False, 'ig_reels': False}

    # IG carousel: 7 gallery images + stats card = 8 total (Meta allows up to 10)
    carousel_urls = image_urls[:7] + [image_urls[-1]]
    print(f'[pipeline] Step 7: Posting to Instagram carousel ({len(carousel_urls)} images)...')
    publisher.post_instagram_carousel(carousel_urls, caption_text)
    platforms['ig_feed'] = True

    print('[pipeline] Step 8: Posting to Instagram Reels...')
    publisher.post_instagram_reels(reels_url, caption_text)
    platforms['ig_reels'] = True

    # ── Step 7: Record in Supabase ────────────────────────────────────────────
    print('[pipeline] Step 9: Recording in posted_sets...')
    db.mark_as_posted(set_num, set_data.get('name', ''), platforms)

    # ── Step 8: Clean up tmp/ ─────────────────────────────────────────────────
    print('[pipeline] Step 10: Cleaning up tmp/ files...')
    _cleanup(all_paths + [reels_path])

    # ── Step 9: Notify success ────────────────────────────────────────────────
    print('[pipeline] Step 11: Sending success email...')
    notifier.send_success(set_data, platforms)

    print(f'\n[pipeline] Done. {set_num} posted successfully.')
    print(f'  IG Feed:  {"OK" if platforms["ig_feed"] else "X"}')
    print(f'  IG Reels: {"OK" if platforms["ig_reels"] else "X"}')


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
