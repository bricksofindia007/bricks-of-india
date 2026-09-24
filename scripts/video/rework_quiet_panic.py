"""
rework_quiet_panic.py -- poll-and-rework for the Quiet Panic format.
Consumes quiet_panic_posts rows the operator rejected WITH a specific
rejection_reason (status='rejected'), regenerates the script in revision
mode (same candidate data, plus the rejected script and the reason as
explicit context), re-renders through the full pipeline, and inserts the
result as a new pending_approval row pointing back at the original via
reworked_from. Never reprocesses a row twice: the original is marked
reworked=true whether the rework succeeds or gets escalated.

Escalation cap: if a set_number accumulates 2 rows that reach
status='rejected' (the original + a reworked version that was ALSO
rejected), automated rework stops for that set -- flagged to
BOI_MASTER_TRACKER.md instead of a third automatic attempt.

Deliberately imports scripts/video/generate_quiet_panic_video.py's
get_supabase()/process_candidate() rather than duplicating them -- operator
decision 2026-07-31: the strict zero-import isolation precedent
(publish_quiet_panic.py vs engine.py/publish.py) is specifically about the
VID-P4-vs-Quiet-Panic boundary, not about splitting Quiet Panic's own
single generation pipeline into two copies. The only thing that differs
between a fresh candidate and a rework is what feeds INTO script-gen
(revision_context or not); TTS/gates/mix/assembly/upload downstream is one
shared code path. Imports nothing from publish_quiet_panic.py or engine.py.
"""

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

import generate_quiet_panic_video as gqpv

ESCALATION_THRESHOLD = 2  # 2 rejected rows for the same set_number -> stop automated rework
TRACKER_PATH = Path(__file__).parent.parent.parent / 'BOI_MASTER_TRACKER.md'
ESCALATION_SECTION_HEADER = '## VID-QP Rework — Escalated Sets (operator attention needed)'


def send_review_email(result: dict, original: dict | None) -> bool:
    """
    Issue #179 (2026-09-24): the one-time "video ready for review" email for a
    REWORKED row. Before this, only video-generate-quiet-panic.yml sent that
    email (a workflow step reading $GITHUB_OUTPUT for its single candidate);
    video-rework-poller-quiet-panic.yml had no notification step at all, so
    reworked rows (QP #34/#35/#36, created 2026-09-22) reached
    pending_approval silently and only surfaced in the daily digest.

    Sent from Python here rather than as a workflow step because one rework
    run can produce several rows -- a single-candidate $GITHUB_OUTPUT step
    can't represent that. Same content as the fresh-candidate email, plus the
    rejection reason being addressed. Returns False (never raises) if the
    send failed, so the caller can fail the job visibly instead of silently.
    """
    import notifier  # Resend sender shared with VID-P4 (_send is its single send path)

    title = (result.get('set_title') or '').replace('\ufeff', '')
    reason = ((original or {}).get('rejection_reason') or '').replace('\ufeff', '')
    subject = f"Quiet Panic video ready for review (rework): {title} (#{result.get('set_number')})"
    html = f"""
<h2>Quiet Panic — reworked video ready for review</h2>
<p>A reworked Quiet Panic video passed all gates and is ready for your review.</p>
<p><strong>Set:</strong> {title} (#{result.get('set_number')})<br>
<strong>Price:</strong> Rs.{result.get('price_inr')}<br>
<strong>Row id:</strong> {result.get('post_id')}<br>
<strong>Reworked from:</strong> {result.get('reworked_from')}</p>
<p><strong>Rejection reason this rework addresses:</strong><br>{reason or '(none recorded)'}</p>
<p><a href="{result.get('storage_url') or ''}">Watch it here</a><br>{result.get('storage_url') or ''}</p>
<p>Watch this, then tell Claude "approved" or "rejected: &lt;reason&gt;" in chat.</p>
<hr>
<p style="color:#888;font-size:12px;">Bricks of India — VID-QP rework poller (issue #179)</p>
"""
    try:
        notifier._send(subject, html)
        return True
    except Exception as exc:
        print(f'ERROR: ready-for-review email failed for {result.get("post_id")}: {exc}', file=sys.stderr)
        return False


def _notify_if_pending(result: dict, original: dict) -> bool:
    """Email only for rows that actually entered pending_approval (a rework
    that fails gates lands publish_blocked -- no review email, same rule as
    the fresh-candidate path)."""
    if result.get('status') != 'pending_approval':
        print(f"  No review email: new row status={result.get('status')} (only pending_approval is emailed).")
        return True
    ok = send_review_email(result, original)
    if ok:
        print(f"  Ready-for-review email sent for {result['post_id']}.")
    return ok


def fetch_rejected_queue(sb) -> list:
    """status='rejected' AND reworked=false, filtered further in Python for
    a non-null rejection_reason (a 'rejected' row is only actionable with
    one; a null-reason row would mean the DB write that set status=
    'rejected' forgot to also set rejection_reason -- treated as not-yet-
    actionable rather than guessed at)."""
    rows = (
        sb.table('quiet_panic_posts')
        .select('*')
        .eq('status', 'rejected')
        .eq('reworked', False)
        .order('created_at')
        .execute()
        .data
    )
    return [r for r in rows if r.get('rejection_reason')]


def count_rejected_for_set(sb, set_number: str) -> list:
    """All quiet_panic_posts row ids with status='rejected' for this
    set_number, regardless of reworked flag -- the escalation count is a
    historical fact about the set, not just about currently-queued rows."""
    res = (
        sb.table('quiet_panic_posts')
        .select('id')
        .eq('set_number', set_number)
        .eq('status', 'rejected')
        .execute()
    )
    return [r['id'] for r in res.data]


def append_tracker_escalation(set_number: str, set_title: str, rejected_ids: list) -> None:
    if not TRACKER_PATH.exists():
        raise FileNotFoundError(f'BOI_MASTER_TRACKER.md not found at {TRACKER_PATH}')
    text = TRACKER_PATH.read_text(encoding='utf-8')
    date_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    id_list = ', '.join(f'`{i}`' for i in rejected_ids)
    entry = (
        f'- **{date_str}** — set `{set_number}` ({set_title}): reached '
        f'{len(rejected_ids)} rejected rows ({id_list}). Automated rework '
        f'stopped after {ESCALATION_THRESHOLD} rejections per '
        f'rework_quiet_panic.py\'s escalation cap -- needs operator\'s '
        f'direct attention (manual rework, or abandon this set). Not '
        f'auto-retried further.\n'
    )

    if ESCALATION_SECTION_HEADER in text:
        idx = text.index(ESCALATION_SECTION_HEADER)
        insert_at = text.index('\n', idx) + 1
        new_text = text[:insert_at] + entry + text[insert_at:]
    else:
        marker = '\n---\n'
        first_sep = text.index(marker)
        insert_at = first_sep + len(marker)
        section = f'\n{ESCALATION_SECTION_HEADER}\n\n{entry}\n---\n'
        new_text = text[:insert_at] + section + text[insert_at:]

    TRACKER_PATH.write_text(new_text, encoding='utf-8')


def rework_one(sb, row: dict) -> dict:
    set_number = row['set_number']
    meta_res = (
        sb.table('sets')
        .select('theme,pieces,image_url')
        .eq('set_number', set_number)
        .limit(1)
        .execute()
    )
    meta = meta_res.data[0] if meta_res.data else {}

    candidate = {
        'set_number': set_number,
        'set_title': row['set_title'],
        'price_inr': row['price_inr'],
        'pieces': meta.get('pieces'),
        'theme': meta.get('theme'),
        'image_url': meta.get('image_url', ''),
    }
    revision_context = {
        'original_script': row['script'],
        'rejection_reason': row['rejection_reason'],
    }
    return gqpv.process_candidate(candidate, reworked_from=row['id'], revision_context=revision_context)


def poll_and_rework() -> int:
    sb = gqpv.get_supabase()

    queue = fetch_rejected_queue(sb)
    if not queue:
        print('[rework_quiet_panic] No rejected rows with a reason awaiting rework. Nothing to do.')
        return 0

    print(f'[rework_quiet_panic] Found {len(queue)} rejected row(s) awaiting rework.')
    exit_code = 0

    for row in queue:
        rid = row['id']
        set_number = row['set_number']
        print(f"\n--- {rid} ({row['set_title']}, set {set_number}) ---")

        rejected_ids = count_rejected_for_set(sb, set_number)
        if len(rejected_ids) >= ESCALATION_THRESHOLD:
            print(f'ESCALATION: set {set_number} has {len(rejected_ids)} rejected row(s) '
                  f'(>= {ESCALATION_THRESHOLD}) -- stopping automated rework, flagging to tracker.')
            try:
                append_tracker_escalation(set_number, row['set_title'], rejected_ids)
            except Exception as e:
                print(f'WARN: failed to write tracker escalation note: {e}', file=sys.stderr)
                exit_code = 1
            sb.table('quiet_panic_posts').update({'reworked': True}).eq('id', rid).execute()
            continue

        try:
            result = rework_one(sb, row)
            print(f"  Reworked -> new row {result['post_id']} (status={result['status']})")
        except Exception as e:
            print(f'ERROR: rework failed for {rid}: {e}', file=sys.stderr)
            exit_code = 1
            continue

        sb.table('quiet_panic_posts').update({'reworked': True}).eq('id', rid).execute()
        if not _notify_if_pending(result, row):
            exit_code = 1

    return exit_code


def rework_one_by_id(sb, row_id: str) -> int:
    """Targeted rework for a single row, bypassing fetch_rejected_queue()'s
    escalation-gated queue fetch entirely -- calls the same real rework_one()
    every automated poll goes through, just without the "2 rejected rows for
    this set_number -> stop and escalate instead" check first.

    Added 2026-08-23 for a real, evidence-based case: Kakamora's rework row
    (26c3605e) is set_number 43293's SECOND rejected row (the original
    67245eff is also status='rejected'), so poll_and_rework()'s normal queue
    fetch would immediately hit ESCALATION_THRESHOLD=2 and refuse to
    generate anything -- correct default behavior (don't loop an automated
    rework a 3rd time without a human back in the loop), but this specific
    3rd attempt IS the human explicitly back in the loop, requesting it by
    id by name. Does not touch or bypass fetch_rejected_queue()/
    poll_and_rework()'s own escalation logic for any OTHER row -- the
    scheduled cron's normal runs are completely unaffected, since this
    function is only ever reached via the --row-id CLI flag, never via
    --poll-and-rework.

    Does not check or require status='rejected' on the target row (unlike
    the queue-based path) -- the caller is asserting this specific row is
    ready for rework by id, not asking this function to also re-derive
    that from status. Still requires a non-null rejection_reason, same
    substantive precondition the queue path enforces, just not gated on
    status specifically."""
    res = sb.table('quiet_panic_posts').select('*').eq('id', row_id).limit(1).execute()
    if not res.data:
        print(f'ERROR: no quiet_panic_posts row with id {row_id}', file=sys.stderr)
        return 1
    row = res.data[0]
    if not row.get('rejection_reason'):
        print(f'ERROR: row {row_id} has no rejection_reason set -- not actionable.', file=sys.stderr)
        return 1

    print(f"--- Targeted rework: {row_id} ({row['set_title']}, set {row['set_number']}) ---")
    try:
        result = rework_one(sb, row)
        print(f"  Reworked -> new row {result['post_id']} (status={result['status']})")
    except Exception as e:
        print(f'ERROR: rework failed for {row_id}: {e}', file=sys.stderr)
        return 1

    sb.table('quiet_panic_posts').update({'reworked': True}).eq('id', row_id).execute()
    return 0 if _notify_if_pending(result, row) else 1


def send_review_email_for_existing(sb, row_id: str) -> int:
    """--send-review-email: (re)send the rework ready-for-review email for an
    EXISTING reworked row, from its stored data. Used to verify #179's email
    path against a real rework row without generating a new video, and to
    backfill a missed email if one ever fails."""
    res = sb.table('quiet_panic_posts').select('*').eq('id', row_id).limit(1).execute()
    if not res.data:
        print(f'ERROR: no quiet_panic_posts row with id {row_id}', file=sys.stderr)
        return 1
    row = res.data[0]
    if not row.get('reworked_from'):
        print(f'ERROR: row {row_id} is not a rework (reworked_from is null).', file=sys.stderr)
        return 1
    orig = sb.table('quiet_panic_posts').select('rejection_reason').eq('id', row['reworked_from']).limit(1).execute().data
    result = {
        'post_id': row['id'], 'set_title': row['set_title'], 'set_number': row['set_number'],
        'price_inr': row['price_inr'], 'storage_url': row.get('storage_url'),
        'reworked_from': row['reworked_from'], 'status': 'pending_approval',
    }
    return 0 if send_review_email(result, orig[0] if orig else None) else 1


def main():
    parser = argparse.ArgumentParser(description='Quiet Panic rejection-rework poller.')
    parser.add_argument('--poll-and-rework', action='store_true', help='Poll quiet_panic_posts for rejected rows with a reason and rework them.')
    parser.add_argument('--send-review-email', default=None, metavar='ROW_ID', help='(Re)send the rework ready-for-review email for an existing reworked row (issue #179 verification/backfill). Generates nothing.')
    parser.add_argument('--row-id', default=None, help='Targeted rework for one specific quiet_panic_posts row id, bypassing the escalation-gated queue fetch. Manual use only -- not called by the scheduled poller.')
    args = parser.parse_args()

    if args.send_review_email:
        sys.exit(send_review_email_for_existing(gqpv.get_supabase(), args.send_review_email))
    if args.row_id:
        sb = gqpv.get_supabase()
        sys.exit(rework_one_by_id(sb, args.row_id))
    elif args.poll_and_rework:
        sys.exit(poll_and_rework())
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
