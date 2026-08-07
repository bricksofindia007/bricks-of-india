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


# Tiers, tried in order. Tier 1 (current-year) is scraper.get_new_set()'s
# existing default behavior, unchanged. Tier 2/3 only run if every prior
# tier produced zero passing candidates -- confirmed necessary by the
# Aug 6/7 real-world failures, where the entire current-year candidate
# pool was either non-buildable junk or genuinely lacked enough gallery
# photos. 1932 = LEGO's founding year, used as an inclusive lower bound
# for "pre-2020" rather than leaving it open-ended.
_TIERS = [
    ('current-year', None, None, True),
    ('2020-2025',     2020, 2025, False),
    ('pre-2020',      1932, 2019, False),
]


def _find_candidate_tiered() -> tuple[dict | None, str | None]:
    """Tries each tier in order; returns (set_data, winning_tier_name).
    winning_tier_name is None (alongside set_data=None) only if every tier
    is exhausted with no passing candidate."""
    for tier_name, y_start, y_end, require_new in _TIERS:
        print(f'[pipeline] Trying tier: {tier_name}...')
        candidate = scraper.get_new_set(y_start, y_end, require_genuinely_new=require_new)
        if candidate is not None:
            print(f'[pipeline] Tier "{tier_name}" produced a candidate.')
            return candidate, tier_name
        print(f'[pipeline] Tier "{tier_name}" produced zero passing candidates.')
    return None, None


def main() -> None:
    # ── Step 1: Find a new set (tiered) ───────────────────────────────────────
    print('[pipeline] Step 1: Looking for a new set...')
    set_data, winning_tier = _find_candidate_tiered()

    if set_data is None:
        skip_reason = ('no candidate cleared the gallery gate in any tier '
                        '(current-year, 2020-2025, pre-2020)')
        print(f'[pipeline] {skip_reason}. Exiting cleanly.')
        db.record_heartbeat('instagram', success=None, error=skip_reason)
        db.record_heartbeat('youtube',   success=None, error=skip_reason)
        sys.exit(0)

    print(f'[pipeline] Winning tier: {winning_tier}')
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

    # Instagram and YouTube are independent platforms — one failing (e.g. an
    # expired IG token) must not prevent the other from posting. Each gets its
    # own try/except and heartbeat write; a failure here does not raise past
    # this block, so Step 9 (YouTube) always runs regardless of IG's outcome.
    ig_failure_reason = None
    try:
        # IG carousel: 7 gallery images + stats card = 8 total (Meta allows up to 10)
        carousel_urls = image_urls[:7] + [image_urls[-1]]
        print(f'[pipeline] Step 7: Posting to Instagram carousel ({len(carousel_urls)} images)...')
        publisher.post_instagram_carousel(carousel_urls, caption_text)
        platforms['ig_feed'] = True

        print('[pipeline] Step 8: Posting to Instagram Reels...')
        publisher.post_instagram_reels(reels_url, caption_text)
        platforms['ig_reels'] = True
        db.record_heartbeat('instagram', success=True)
    except Exception as ig_exc:
        ig_failure_reason = str(ig_exc)
        print(f'[pipeline] Instagram posting failed: {ig_exc}')
        db.record_heartbeat('instagram', success=False, error=ig_failure_reason)

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

    print(f'\n[pipeline] Done. {set_num} processed.')
    print(f'  IG Feed:  {"OK" if platforms["ig_feed"] else "FAIL — " + (ig_failure_reason or "unknown")}')
    print(f'  IG Reels: {"OK" if platforms["ig_reels"] else "FAIL — " + (ig_failure_reason or "unknown")}')
    print(f'  YouTube:  {"OK" if platforms["yt_shorts"] else "FAIL — " + (yt_failure_reason or "unknown")}')

    failure_reasons = []
    if ig_failure_reason:
        failure_reasons.append(f'Instagram: {ig_failure_reason}')
    if yt_failure_reason:
        failure_reasons.append(f'YouTube: {yt_failure_reason}')

    if failure_reasons:
        print(f'[pipeline] Exiting non-zero: {"; ".join(failure_reasons)}')
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
