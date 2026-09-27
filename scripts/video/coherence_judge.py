"""
VID-QP coherence judge (#365, 27 Sep 2026): one Groq call that reads the
FINAL script text and replies COHERENT / INCOHERENT: <reason>.

FAILS CLOSED. Any failure to obtain a real verdict -- no GROQ_API_KEY, HTTP
error (dead model 404, quota 429, 5xx), timeout, malformed response, or an
empty/unrecognised reply -- returns pass=False with held=True. The row then
lands `publish_blocked` (publish_quiet_panic.py's assert_all_gates_passed()
refuses it unless an approver sets gate_override with a reason), and
generate_quiet_panic_video.py still uploads the render and emails a
"held for manual review" notice, so a human judges it instead.

Why: the previous in-file judge failed OPEN. When Groq shut down
qwen/qwen3.6-27b on 14 Sep 2026, every QP script after that passed the
coherence gate without being judged, and nothing surfaced it. The model
dying only exposed the real defect: "judge unavailable" was treated as
"judge approved".

Standalone on purpose: stdlib plus a lazily imported `requests`, so the unit
tests (test_coherence_judge.py) run with no third-party installs, and
generate_quiet_panic_video.py keeps its no-gates.py-import rule.
"""

from __future__ import annotations

import os

# Same model as gates.py's VID-P4 judge since 2026-09-17: Groq GA, not
# deprecated per console.groq.com/docs/deprecations (read 27 Sep 2026).
# gpt-oss needs a low reasoning setting or it can spend the whole output
# budget on hidden reasoning and return no visible verdict.
COHERENCE_JUDGE_MODEL = 'openai/gpt-oss-120b'
COHERENCE_JUDGE_REASONING_EFFORT = 'low'
GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

JUDGE_PROMPT = (
    "You are a strict but fair editor reviewing a short video script that will be "
    "read aloud verbatim. Reply with exactly one line: 'COHERENT' if the script "
    "reads as complete, sensible English with no garbled, truncated, or nonsensical "
    "fragments (for example, an ending like 'No stranding.' with no clear referent "
    "to anything earlier in the script would NOT be coherent) -- or "
    "'INCOHERENT: <short reason>' if it does not.\n\nSCRIPT:\n"
)


def _held(reason: str) -> dict:
    return {
        'pass': False,
        'held': True,
        'detail': f'HELD for manual review: no real coherence verdict ({reason}). '
                  f'Fail-closed since #365 -- a human must judge this script.',
    }


def judge_coherence(full_text: str, post=None, api_key: str | None = None, timeout: int = 30) -> dict:
    """Returns a gate dict: {'pass': bool, 'detail': str} plus 'held': True
    when no real verdict was obtained. `post` is injectable for tests
    (defaults to requests.post)."""
    key = (api_key if api_key is not None else os.environ.get('GROQ_API_KEY', '')).strip().lstrip('﻿')
    if not key:
        return _held('GROQ_API_KEY not set')
    if post is None:
        import requests  # lazy: keeps the unit tests dependency-free
        post = requests.post
    try:
        resp = post(
            GROQ_CHAT_URL,
            headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
            json={
                'model': COHERENCE_JUDGE_MODEL,
                'messages': [{'role': 'user', 'content': JUDGE_PROMPT + full_text}],
                'max_tokens': 200,
                'temperature': 0.0,
                'reasoning_effort': COHERENCE_JUDGE_REASONING_EFFORT,
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        verdict = (resp.json()['choices'][0]['message']['content'] or '').strip()
    except Exception as e:  # dead model, quota, timeout, malformed body: all mean "not judged"
        return _held(f'judge call failed: {type(e).__name__}: {str(e)[:200]}')
    upper = verdict.upper()
    if upper.startswith('COHERENT'):
        return {'pass': True, 'detail': verdict}
    if upper.startswith('INCOHERENT'):
        return {'pass': False, 'detail': verdict}
    return _held(f'unrecognised judge reply: {verdict[:120]!r}')


def only_held_failures(gate_results: dict) -> bool:
    """True when at least one gate failed and EVERY failing gate is a
    held (judge-unavailable) result -- i.e. the script failed nothing it was
    actually checked on, and needs a human verdict rather than a rejection."""
    failing = [r for k, r in gate_results.items()
               if not k.startswith('_') and isinstance(r, dict) and r.get('pass') is not True]
    return bool(failing) and all(r.get('held') is True for r in failing)
