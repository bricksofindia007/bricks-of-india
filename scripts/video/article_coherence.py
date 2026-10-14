"""
Gate 14 article coherence judge (P5 Step 1a / P6 Step 4, #390): the SAME fail-closed Groq judge
as VID-QP (coherence_judge.judge_coherence), with an article prompt. It reads a review's text and
answers COHERENT or INCOHERENT: <reasons>.

It judges only what the text itself shows: self-contradiction (one quantity stated two ways),
a verdict that contradicts the body's own reasoning or another verdict line, truncated or garbled
passages, and narration of another article ("the reviewer", "the source"). It can't check facts
against the world; Gate 14's deterministic checks and human batch review do that (#390).

QUOTA SAFETY (P6 Step 4): the VID-P4/VID-QP judges share GROQ_API_KEY and fail CLOSED, so the
article judge must never be what exhausts the quota:
  * a hard per-run token budget (ARTICLE_JUDGE_TOKEN_BUDGET, default 60,000). Every call's cost is
    estimated BEFORE it is made, and the run stops before the budget would be crossed;
  * it stops at the FIRST held result (429/quota, 5xx, timeout: anything that isn't a real
    verdict). It never retries, so under quota pressure it backs off immediately;
  * read-only: writes nothing to the database; results go to a JSON file + the step summary.

  python scripts/video/article_coherence.py   (env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
      GROQ_API_KEY, ARTICLE_JUDGE_OFFSET, ARTICLE_JUDGE_LIMIT, ARTICLE_JUDGE_TOKEN_BUDGET, OUT_DIR)
"""

from __future__ import annotations

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from coherence_judge import judge_coherence  # noqa: E402
from secrets_util import get_secret  # noqa: E402

ARTICLE_JUDGE_PROMPT = (
    "You are a strict but fair editor checking a published LEGO set review for INTERNAL consistency "
    "only. Do not judge whether facts are true in the world. Reply with exactly one line: 'COHERENT' "
    "if none of the problems below occur, or 'INCOHERENT: <problem>; <problem>' naming each one briefly "
    "(quote the conflicting numbers or lines). Problems: (1) the same quantity (price, piece count, "
    "minifigure count, date) is stated with two different values; (2) more than one verdict is given, or "
    "the final verdict contradicts the body's own reasoning (e.g. says the price is too high, then BUY NOW "
    "without explanation); (3) truncated, garbled or nonsensical passages; (4) the text narrates another "
    "article or reviewer ('the reviewer says', 'according to the source') instead of speaking in its own "
    "voice. A dated 'Corrected …' or 'Updated …' note that explains a change is NOT a contradiction."
    "\n\nREVIEW:\n"
)
MAX_OUTPUT_TOKENS = 300
CHARS_PER_TOKEN = 3.5  # conservative (over-estimates tokens for English prose)
TPM_SHARE = 4000       # tokens/minute this job allows itself (half the free tier's ~8k TPM)


def estimate_tokens(text: str) -> int:
    return int((len(ARTICLE_JUDGE_PROMPT) + len(text)) / CHARS_PER_TOKEN) + MAX_OUTPUT_TOKENS


def plan_batch(texts: list[str], budget: int) -> int:
    """How many of `texts` (in order) fit inside `budget` estimated tokens."""
    used, n = 0, 0
    for t in texts:
        cost = estimate_tokens(t)
        if used + cost > budget:
            break
        used += cost
        n += 1
    return n


def fetch_reviews(url: str, key: str) -> list[dict]:
    import requests
    out, off = [], 0
    while True:
        r = requests.get(f"{url.rstrip('/')}/rest/v1/reviews?select=slug,title,content,verdict&order=slug.asc",
                         headers={'apikey': key, 'Authorization': f'Bearer {key}', 'Range': f'{off}-{off + 999}'}, timeout=30)
        r.raise_for_status()
        rows = r.json()
        out.extend(rows)
        if len(rows) < 1000:
            return out
        off += 1000


def main() -> int:
    url, key = get_secret('SUPABASE_URL'), get_secret('SUPABASE_SERVICE_ROLE_KEY')
    offset = int(get_secret('ARTICLE_JUDGE_OFFSET', '0') or 0)
    limit = int(get_secret('ARTICLE_JUDGE_LIMIT', '1000') or 1000)
    budget = int(get_secret('ARTICLE_JUDGE_TOKEN_BUDGET', '60000') or 60000)
    out_dir = get_secret('OUT_DIR', 'article-judge-out')
    os.makedirs(out_dir, exist_ok=True)

    reviews = fetch_reviews(url, key)[offset:offset + limit]
    texts = [f"TITLE: {r['title']}\nSTORED VERDICT: {r['verdict']}\n\n{r['content'] or ''}" for r in reviews]
    fits = plan_batch(texts, budget)
    results, stopped = [], None
    used = 0
    for r, t in zip(reviews[:fits], texts[:fits]):
        res = judge_coherence(t, prompt=ARTICLE_JUDGE_PROMPT, max_tokens=MAX_OUTPUT_TOKENS, timeout=45)
        used += estimate_tokens(t)
        results.append({'slug': r['slug'], 'pass': res['pass'], 'held': res.get('held', False), 'detail': res['detail']})
        if res.get('held'):
            stopped = f"stopped at {r['slug']}: no real verdict ({res['detail'][:160]}), no retry, to protect the video judges' quota"
            break
        # Pace to half the free tier's ~8k tokens/minute, so a video judge firing mid-run still has room.
        time.sleep(max(2.5, estimate_tokens(t) / TPM_SHARE * 60))
    judged = [x for x in results if not x['held']]
    flags = [x for x in judged if not x['pass']]
    summary = {
        'offset': offset, 'considered': len(reviews), 'fit_in_budget': fits, 'judged': len(judged),
        'incoherent': len(flags), 'held': len(results) - len(judged), 'estimated_tokens_used': used,
        'token_budget': budget, 'next_offset': offset + len(judged), 'stopped': stopped,
    }
    json.dump({'summary': summary, 'results': results}, open(os.path.join(out_dir, f'article-judge-{offset}.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    lines = [f"## Article coherence judge (read-only), offset {offset}", '', '```', json.dumps(summary, indent=1), '```', '']
    lines += [f"- **{x['slug']}**: {x['detail'][:300]}" for x in flags]
    print('\n'.join(lines))
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf8').write('\n'.join(lines) + '\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
