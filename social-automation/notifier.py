"""
notifier.py — Resend email alerts for pipeline success/failure.
"""

import os
from datetime import date
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
FROM_ADDRESS = 'notifications@bricksofindia.com'
TO_ADDRESS = 'abhinav@bricksofindia.com'


def _send(subject: str, html_body: str) -> None:
    import resend
    resend.api_key = RESEND_API_KEY
    if not RESEND_API_KEY:
        print(f'[notifier] RESEND_API_KEY not set — skipping email: {subject}')
        return
    result = resend.Emails.send({
        'from': f'Bricks of India <{FROM_ADDRESS}>',
        'to': [TO_ADDRESS],
        'subject': subject,
        'html': html_body,
    })
    print(f'[notifier] Email sent. ID: {result.get("id")}')


def send_failure(error: Exception, traceback_str: str, module_name: str = 'unknown') -> None:
    today = date.today().isoformat()
    subject = f'⚠️ BOI Social Pipeline Failed — {today}'
    html = f"""
<h2>Social Automation Pipeline Failure</h2>
<p><strong>Date:</strong> {today}</p>
<p><strong>Module that failed:</strong> <code>{module_name}</code></p>
<p><strong>Error:</strong></p>
<pre style="background:#fee;padding:12px;border-radius:4px;">{type(error).__name__}: {error}</pre>
<p><strong>Full traceback:</strong></p>
<pre style="background:#f5f5f5;padding:12px;border-radius:4px;font-size:12px;">{traceback_str}</pre>
<hr>
<p style="color:#888;font-size:12px;">Bricks of India — bricksofindia.com</p>
"""
    try:
        _send(subject, html)
    except Exception as notify_exc:
        # Never let notifier failures mask the original error
        print(f'[notifier] Failed to send failure email: {notify_exc}')


def send_success(set_data: dict, platforms: dict, row_id: int = None) -> None:
    set_num = set_data.get('set_num', 'unknown')
    set_name = set_data.get('set_name') or set_data.get('name', 'unknown')
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
