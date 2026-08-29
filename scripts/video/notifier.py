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


def send_ready_for_review_notification(
    story_number: int, set_title: str, storage_url: str, qc_frame_urls: list[str] | None,
    escalation_note: dict | None = None,
) -> None:
    """
    Fires once per day, right after --cloud-generate lands a fresh candidate
    in status='pending_approval' -- closes the "how will I know a new one is
    ready" gap without a dashboard: the operator gets exactly the three
    things they were otherwise pulling from Supabase manually on request
    (story number, storage_url, qc_frame_urls). Same Resend path as
    send_publish_notification/send_skip_notification -- no new email
    mechanism.

    escalation_note added 2026-08-29 (Gate Remediation Architecture,
    engine.build_escalation_note()) -- None for a clean story (every gate
    passed, or a failure was fully auto-remediated), in which case this
    email renders exactly as it always did: a story with zero unresolved
    flags must look identical to one that passed every gate clean. When
    present, it renders FIRST, above the subject line's own visual weight
    (red banner, before the QC frames) -- this is the fix for the actual
    trigger incident (story #54): a failing gate must never require the
    reviewer to go query gate_results themselves to find out.
    """
    safe_title = (set_title or 'Unknown set').replace('﻿', '')
    subject_prefix = '🚩 ' if escalation_note else '📋 '
    subject = f'{subject_prefix}VID-P4 Story #{story_number} ready for review — {safe_title}'

    escalation_html = ''
    if escalation_note:
        gates_rows = ''
        for g in escalation_note.get('gates', []):
            gates_rows += f"""
<tr>
  <td style="padding:6px 10px;border-bottom:1px solid #f5c6c6;"><code>{g.get('gate', '')}</code></td>
  <td style="padding:6px 10px;border-bottom:1px solid #f5c6c6;">{g.get('what_it_caught', '')}</td>
  <td style="padding:6px 10px;border-bottom:1px solid #f5c6c6;color:#888;font-size:12px;">{g.get('technical_reason', '')}</td>
</tr>"""
        escalation_html = f"""
<div style="background:#fdecea;border:1px solid #f5c6c6;border-radius:6px;padding:14px 16px;margin-bottom:20px;">
  <p style="margin:0 0 8px;font-weight:bold;color:#a33;">⚠️ This story has an unresolved gate issue — remediation was attempted first, this is what's left.</p>
  <table style="border-collapse:collapse;width:100%;margin-bottom:8px;">
    <tr style="text-align:left;font-size:12px;color:#a33;">
      <th style="padding:4px 10px;">Gate</th><th style="padding:4px 10px;">What it caught</th><th style="padding:4px 10px;">Technical detail</th>
    </tr>
    {gates_rows}
  </table>
  <p style="margin:8px 0 4px;"><strong>Remediation attempted:</strong> {escalation_note.get('remediation_attempted', '')}</p>
  <p style="margin:0;"><strong>Decision needed:</strong> {escalation_note.get('decision_needed', '')}</p>
</div>"""

    frames_html = ''
    for url in (qc_frame_urls or []):
        frames_html += f'<img src="{url}" style="width:180px;margin:4px;border-radius:8px;" />'

    html = f"""
<h2>Story #{story_number} ready for review</h2>
{escalation_html}
<p><strong>Set:</strong> {safe_title}</p>
<p><strong>Video:</strong> <a href="{storage_url}">{storage_url}</a></p>
<h3>QC Frames</h3>
<div>{frames_html or '<p>none captured</p>'}</div>
<hr>
<p style="color:#888;font-size:12px;">Bricks of India — bricksofindia.com — VID-P4</p>
"""
    try:
        _send(subject, html)
    except Exception as exc:
        print(f'[notifier] Failed to send ready-for-review notification: {exc}')


def send_rejection_reminder(pending_rows: list[dict]) -> None:
    """
    Biweekly content_rejections review reminder -- fires from
    engine.check_and_send_rejection_reminder() only when both the 14-day
    timer is due and at least one row is genuinely review_status='pending'
    (caller's responsibility; this function just renders whatever list it's
    given). pending_rows: dicts with set_number, set_title, rejected_at,
    rejection_reason (rejection_reason may be None -- not every rejection
    has one recorded).
    """
    count = len(pending_rows)
    subject = f'🗂️ VID-P4 rejection review — {count} pending item{"s" if count != 1 else ""}'

    rows_html = ''
    for row in pending_rows:
        safe_title = (row.get('set_title') or 'Unknown set').replace('﻿', '')
        reason = row.get('rejection_reason') or '<em>no reason recorded</em>'
        rows_html += f"""
<tr>
  <td style="padding:6px 10px;border-bottom:1px solid #eee;">{row.get('set_number') or '—'}</td>
  <td style="padding:6px 10px;border-bottom:1px solid #eee;">{safe_title}</td>
  <td style="padding:6px 10px;border-bottom:1px solid #eee;">{row.get('rejected_at') or '—'}</td>
  <td style="padding:6px 10px;border-bottom:1px solid #eee;">{reason}</td>
</tr>"""

    html = f"""
<h2>Rejection Review — {count} pending item{'s' if count != 1 else ''}</h2>
<p>These sets are currently excluded from future daily candidates pending your review. Flip each row's <code>review_status</code> to <code>cleared_for_regeneration</code> to make it eligible again, or <code>permanently_excluded</code> to keep it out for good.</p>
<table style="border-collapse:collapse;width:100%;">
<tr style="background:#f5f5f5;text-align:left;">
  <th style="padding:6px 10px;">Set #</th>
  <th style="padding:6px 10px;">Title</th>
  <th style="padding:6px 10px;">Rejected At</th>
  <th style="padding:6px 10px;">Reason</th>
</tr>
{rows_html}
</table>
<hr>
<p style="color:#888;font-size:12px;">Bricks of India — bricksofindia.com — VID-P4</p>
"""
    try:
        _send(subject, html)
    except Exception as exc:
        print(f'[notifier] Failed to send rejection reminder: {exc}')


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
