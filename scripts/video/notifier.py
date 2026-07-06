"""
notifier.py — VID-P4 immediate post-publish notification (Stage F).

Fires the moment a video auto-publishes (Thursday onward, when there is no
pre-publish human check) -- not folded into the next day's Morning Brief.
Contains both live post URLs, the QC-frame thumbnails, and the full script
text, so the operator can do a fast phone-based sanity check even while
traveling, without blocking the publish itself (this fires after publish
succeeds, it never gates it).

Reuses the existing Resend pattern (social-automation/notifier.py) rather
than a new email mechanism.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

from secrets_util import get_secret

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent.parent / 'social-automation' / '.env')

# Confirmed live 2026-07-06: the RESEND_API_KEY GitHub Secret carries a
# leading BOM, breaking the Bearer auth header ("'latin-1' codec can't
# encode character '﻿' in position 7" -- position 7 == right after
# "Bearer "). See secrets_util.py for the full pattern -- this recurred
# across 4 different secrets the same day, hence the shared helper.
RESEND_API_KEY = get_secret('RESEND_API_KEY')
FROM_ADDRESS = 'notifications@bricksofindia.com'
TO_ADDRESS = 'abhinav@bricksofindia.com'


def _send(subject: str, html_body: str) -> None:
    import resend
    resend.api_key = RESEND_API_KEY
    if not RESEND_API_KEY:
        print(f'[notifier] RESEND_API_KEY not set - skipping email: {subject}')
        return
    result = resend.Emails.send({
        'from': f'Bricks of India <{FROM_ADDRESS}>',
        'to': [TO_ADDRESS],
        'subject': subject,
        'html': html_body,
    })
    print(f'[notifier] Email sent. ID: {result.get("id")}')


def send_publish_notification(video_post: dict, ig_result: dict | None, yt_result: dict | None) -> None:
    """
    video_post: the video_posts row (set_title, script, qc_frame_urls, etc).
    ig_result / yt_result: whatever publish_video_post() returned for each
    platform, or None if that platform wasn't attempted/failed.

    set_title/script strip a leading BOM (\\ufeff) before use -- same bug
    class already fixed in social-automation/notifier.py's send_success()
    (2026-06-30): a BOM in scraped store/product data crashes Resend's send
    with "'latin-1' codec can't encode character '\\ufeff'". Confirmed live
    here too (2026-07-06, first real publish run) -- the video posted fine,
    but this notification silently failed to send without this fix.
    """
    set_title = video_post.get('set_title', 'Unknown set').replace('﻿', '')
    subject = f'🎬 VID-P4 auto-published — {set_title}'

    links_html = ''
    if ig_result:
        links_html += f'<p><strong>Instagram Reels:</strong> <a href="{ig_result["permalink"]}">{ig_result["permalink"]}</a></p>'
    else:
        links_html += '<p><strong>Instagram Reels:</strong> not posted (see logs)</p>'
    if yt_result:
        links_html += f'<p><strong>YouTube Shorts:</strong> <a href="{yt_result["url"]}">{yt_result["url"]}</a></p>'
    else:
        links_html += '<p><strong>YouTube Shorts:</strong> not posted (see logs)</p>'

    frames_html = ''
    for url in (video_post.get('qc_frame_urls') or []):
        frames_html += f'<img src="{url}" style="width:180px;margin:4px;border-radius:8px;" />'

    script_text = (video_post.get('script') or '').replace('﻿', '').replace('\n', '<br>')

    html = f"""
<h2>Video Auto-Published</h2>
<p><strong>Set:</strong> {set_title}</p>
{links_html}
<h3>QC Frames</h3>
<div>{frames_html or '<p>none captured</p>'}</div>
<h3>Script</h3>
<p style="background:#f5f5f5;padding:12px;border-radius:4px;">{script_text}</p>
<hr>
<p style="color:#888;font-size:12px;">Bricks of India — bricksofindia.com — VID-P4</p>
"""
    try:
        _send(subject, html)
    except Exception as exc:
        print(f'[notifier] Failed to send publish notification: {exc}')


def send_skip_notification(reason: str, candidate_title: str | None = None, gate_failures: list[str] | None = None) -> None:
    """
    Stage E requirement: if a day is skipped (gates failed / candidate pool
    exhausted), notify immediately and explain exactly why -- a missed day
    must never be silent.
    """
    subject = '⚠️ VID-P4 skipped today — no video published'
    safe_title = (candidate_title or '').replace('﻿', '')
    detail = f'<p><strong>Candidate:</strong> {safe_title}</p>' if safe_title else ''
    gates_html = ''
    if gate_failures:
        gates_html = '<ul>' + ''.join(f'<li>{g}</li>' for g in gate_failures) + '</ul>'
    html = f"""
<h2>VID-P4 — No Video Published Today</h2>
<p><strong>Reason:</strong> {reason}</p>
{detail}
{gates_html}
<hr>
<p style="color:#888;font-size:12px;">Bricks of India — bricksofindia.com — VID-P4</p>
"""
    try:
        _send(subject, html)
    except Exception as exc:
        print(f'[notifier] Failed to send skip notification: {exc}')
