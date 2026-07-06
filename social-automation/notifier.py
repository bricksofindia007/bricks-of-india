"""
notifier.py — Resend email alerts for pipeline success/failure.
"""

import os
from datetime import date
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

# .lstrip('﻿'): found live 2026-07-06 while debugging the identical bug in
# VID-P4's notifier.py -- the RESEND_API_KEY GitHub Secret carries a leading
# BOM, which breaks the Bearer auth header ("'latin-1' codec can't encode
# character '﻿' in position 7" -- position 7 is right after "Bearer ").
# Same bug class CLAUDE.md documents for other Bearer-bound keys; this file
# shares the same secret and was never covered by that fix.
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '').lstrip('﻿').strip()
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


def _sanitize(text: str) -> str:
    return text.replace('﻿', '').encode('ascii', 'replace').decode('ascii')


def send_failure(error: Exception, traceback_str: str, module_name: str = 'unknown') -> None:
    today = date.today().isoformat()
    subject = f'BOI Social Pipeline Failed - {today}'
    safe_error = _sanitize(f'{type(error).__name__}: {error}')
    safe_tb = _sanitize(traceback_str)
    html = f"""
<h2>Social Automation Pipeline Failure</h2>
<p><strong>Date:</strong> {today}</p>
<p><strong>Module that failed:</strong> <code>{module_name}</code></p>
<p><strong>Error:</strong></p>
<pre style="background:#fee;padding:12px;border-radius:4px;">{safe_error}</pre>
<p><strong>Full traceback:</strong></p>
<pre style="background:#f5f5f5;padding:12px;border-radius:4px;font-size:12px;">{safe_tb}</pre>
<hr>
<p style="color:#888;font-size:12px;">Bricks of India - bricksofindia.com</p>
"""
    try:
        _send(subject, html)
    except Exception as notify_exc:
        # Never let notifier failures mask the original error
        print(f'[notifier] Failed to send failure email: {notify_exc}')


def send_success(set_data: dict, platforms: dict, row_id: int = None) -> None:
    # Bug fixed 2026-06-30: this function built its HTML email from raw
    # set_name/set_num values with no BOM stripping. A BOM character
    # (\ufeff) in a scraped set_name (LEGO.com/Rebrickable source data,
    # outside our control) crashes the underlying email send with
    # "'latin-1' codec can't encode character '\ufeff'" -- confirmed live
    # from a real pipeline run's log (2026-06-14, run 27495416112). This
    # doesn't block the actual social posts (notify runs at Step 12, after
    # the real IG/YouTube posting and the posted_sets DB write at Step 10
    # already completed) -- but it does mean the "it worked" confirmation
    # email silently never arrives, which from the outside looks
    # indistinguishable from the pipeline not having run at all that day.
    #
    # Deliberately NOT using the existing _sanitize() helper here (used by
    # send_failure() above) -- that function does a full ASCII-only
    # encode/decode round-trip, which would mangle this email's intentional
    # emoji (✅/⏭️) and em-dash into literal '?' characters. The actual bug
    # is narrower than that: only the untrusted, scraped fields (set_name)
    # need BOM stripping; the static HTML template's own formatting should
    # stay exactly as authored.
    set_num = str(set_data.get('set_num', 'unknown')).replace('\ufeff', '')
    set_name = str(set_data.get('set_name') or set_data.get('name', 'unknown')).replace('\ufeff', '')
    subject = f'✅ BOI Posted — {set_name} ({set_num})'

    platform_rows = ''
    for key, posted in platforms.items():
        icon = '✅' if posted else '⏭️ skipped'
        label = key.replace('_', ' ').title()
        platform_rows += f'<tr><td>{label}</td><td>{icon}</td></tr>'

    row_line = f'<p><strong>Supabase row ID:</strong> {row_id}</p>' if row_id else ''

    html = f"""
<h2>Social Post Confirmed</h2>
<p><strong>Set:</strong> {set_name} ({set_num})</p>
<p><strong>Piece count:</strong> {set_data.get('num_parts', 'unknown')}</p>
{row_line}
<h3>Platform Status</h3>
<table border="1" cellpadding="8" style="border-collapse:collapse;">
<tr><th>Platform</th><th>Status</th></tr>
{platform_rows}
</table>
<hr>
<p style="color:#888;font-size:12px;">Bricks of India — bricksofindia.com</p>
"""
    try:
        _send(subject, html)
    except Exception as notify_exc:
        print(f'[notifier] Failed to send success email: {notify_exc}')
