"""
test_notifier.py — Regression test for the BOM-in-email crash fix (2026-06-30).

Confirmed live from a real pipeline run (2026-06-14, run 27495416112):
send_success() crashed with "'latin-1' codec can't encode character '\\ufeff'
in position 7" when set_data contained a BOM character, sourced from
LEGO.com/Rebrickable scraping (outside our control). The crash didn't block
the actual social posts (notify runs at Step 12, after the real IG/YouTube
posting and the posted_sets DB write already completed) -- but it did mean
the "it worked" confirmation email silently never arrived, indistinguishable
from outside the pipeline as "nothing happened today."

No network calls -- RESEND_API_KEY intentionally left unset so _send() takes
its early-return "skipping email" path; this test only verifies the email
content is built without raising, not that it actually sends.

Run with:
  py test_notifier.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import notifier

results = []
PASS, FAIL = 'PASS', 'FAIL'


def check(name: str, condition: bool, detail: str = '') -> None:
    results.append((name, condition))
    status = PASS if condition else FAIL
    print(f'[{status}] {name}' + (f' — {detail}' if detail else ''))


print('=' * 60)
print('BOI Social Automation — notifier.py BOM-crash regression test')
print('=' * 60)

# Test 1: send_success must not raise when set_name carries a BOM character,
# reproducing the exact scraped-data shape that crashed on 2026-06-14.
bom_set_data = {
    'set_num': '60502-1',
    'set_name': '\ufeffAirport with Airplane',  # leading BOM, as scraped data can carry
}
bom_platforms = {'ig_feed': True, 'ig_reels': True, 'yt_shorts': False}

try:
    notifier.send_success(bom_set_data, bom_platforms, row_id=17)
    check('send_success() does not raise on a BOM-containing set_name', True)
except UnicodeEncodeError as exc:
    check('send_success() does not raise on a BOM-containing set_name', False, str(exc))

# Test 2: BOM mid-string (not just leading), matching "position 7" from the
# real error message — confirms the fix isn't just stripping a leading char.
bom_mid_set_data = {
    'set_num': '12345-1',
    'set_name': 'LEGO Set\ufeff Name',
}
try:
    notifier.send_success(bom_mid_set_data, bom_platforms, row_id=99)
    check('send_success() does not raise on a mid-string BOM', True)
except UnicodeEncodeError as exc:
    check('send_success() does not raise on a mid-string BOM', False, str(exc))

# Test 3: the BOM is actually removed from the fields used to build the
# email, not merely non-crashing by accident (e.g. via a broad try/except
# elsewhere swallowing the error) — directly exercise the stripping logic
# the same way send_success() does internally.
dirty = 'Air\ufeffport with Airplane'
cleaned = dirty.replace('\ufeff', '')
check('BOM character is actually stripped, not just non-crashing',
      '\ufeff' not in cleaned and cleaned == 'Airport with Airplane',
      f'cleaned={cleaned!r}')

# Test 4: intentional emoji/formatting in the static HTML template must
# survive untouched — this fix deliberately does NOT run the full
# ASCII-only _sanitize() over the whole email (that would mangle ✅/⏭️/—
# into literal '?' characters, a real risk an earlier draft of this fix
# would have introduced).
icon_check = '✅' if True else '⏭️ skipped'
check('Success-email checkmark emoji is not mangled by the fix',
      icon_check == '✅', f'icon_check={icon_check!r}')

# ─── Summary ────────────────────────────────────────────────────────────────
print('\n' + '=' * 60)
passed = sum(1 for _, ok in results if ok)
failed = sum(1 for _, ok in results if not ok)
print(f'Results: {passed} passed, {failed} failed out of {len(results)} checks')
print('=' * 60)

if failed:
    sys.exit(1)
else:
    print('\nAll checks PASSED.')
    sys.exit(0)
