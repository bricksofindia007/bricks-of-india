"""
Model canary -- daily check that every model referenced in production code
still responds, rather than discovering a deprecation weeks later via a
silently-fail-open gate (see the 2026-08-22 incident: gate_coherence_llm_judge
in both video pipelines targeted a decommissioned Groq model for an unknown
period, always failing open, never actually judging anything -- confirmed
via a live 404 during the qwen rollout evidence pass).

Checks, one per (provider, model, secret) actually used in production:
  - Gemini gemini-2.5-flash            (VID-P4 + VID-QP, GEMINI_SOCIAL_API_KEY)
  - Gemini gemini-2.5-flash-lite       (article pipeline, GEMINI_API_KEY)
  - Groq   qwen/qwen3.6-27b            (all 3 pipelines' fallback, GROQ_API_KEY)
  - Cerebras gpt-oss-120b              (all 3 pipelines' fallback, flagged off
                                         but code kept live -- CEREBRAS_API_KEY)

A missing/empty secret is reported as its OWN distinct failure ("secret not
configured"), not silently skipped and not conflated with "model dead" --
see the qwen rollout's own real finding that GROQ_API_KEY has never been
added as a repo secret at all, which independently makes every Groq call
site (including this fixed coherence gate) fail open in production
regardless of which model is configured. This canary is the mechanism that
would have caught that gap immediately instead of it going unnoticed.

Exit code is non-zero if ANY check fails -- this workflow is meant to show
up red in normal GitHub Actions notifications on failure, the opposite
failure mode of a gate that fails open and never surfaces anything.

Every new model integration added to production code must get a
corresponding check added here (see CLAUDE.md's "Staged/experimental code
rules" section, where this requirement is documented for future sessions).
"""
import os
import sys

import requests


class CanaryResult:
    def __init__(self, name: str, ok: bool, detail: str):
        self.name = name
        self.ok = ok
        self.detail = detail


def check_gemini(label: str, secret_name: str, model: str) -> CanaryResult:
    api_key = os.environ.get(secret_name, '').strip()
    if not api_key:
        return CanaryResult(label, False, f'SECRET NOT CONFIGURED: {secret_name} is empty/unset')
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(model=model, contents='Reply with exactly one word: OK')
        if resp.text and resp.text.strip():
            return CanaryResult(label, True, f'{model} responded: {resp.text.strip()[:50]!r}')
        return CanaryResult(label, False, f'{model} returned empty text (model may be degraded, not necessarily dead)')
    except Exception as e:
        return CanaryResult(label, False, f'{model} call failed: {e}')


def check_groq(label: str, model: str) -> CanaryResult:
    api_key = os.environ.get('GROQ_API_KEY', '').strip()
    if not api_key:
        return CanaryResult(label, False, 'SECRET NOT CONFIGURED: GROQ_API_KEY is empty/unset')
    try:
        body = {
            'model': model,
            'messages': [{'role': 'user', 'content': 'Reply with exactly one word: OK'}],
            'max_tokens': 20,
        }
        if model.startswith('qwen/'):
            body['reasoning_effort'] = 'none'
        resp = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json=body,
            timeout=30,
        )
        if resp.status_code == 404:
            return CanaryResult(label, False, f'{model}: 404 -- likely decommissioned/model_not_found. Raw: {resp.text[:200]}')
        resp.raise_for_status()
        content = resp.json()['choices'][0]['message']['content']
        return CanaryResult(label, True, f'{model} responded: {content.strip()[:50]!r}')
    except Exception as e:
        return CanaryResult(label, False, f'{model} call failed: {e}')


def check_cerebras(label: str, model: str) -> CanaryResult:
    api_key = os.environ.get('CEREBRAS_API_KEY', '').strip()
    if not api_key:
        return CanaryResult(label, False, 'SECRET NOT CONFIGURED: CEREBRAS_API_KEY is empty/unset')
    try:
        from cerebras.cloud.sdk import Cerebras
        client = Cerebras(api_key=api_key)
        resp = client.chat.completions.create(
            model=model,
            messages=[{'role': 'user', 'content': 'Reply with exactly one word: OK'}],
            max_tokens=20,
        )
        content = resp.choices[0].message.content
        if content and content.strip():
            return CanaryResult(label, True, f'{model} responded: {content.strip()[:50]!r}')
        return CanaryResult(label, False, f'{model} returned empty content')
    except Exception as e:
        # Cerebras is currently payment-blocked (402) as of 2026-08-18 --
        # that's an EXPECTED, already-known condition (see
        # cerebras_fallback_enabled's docstring), reported distinctly from
        # a genuine model-death 404 so this canary doesn't cry wolf every
        # day for a condition Abhinav already knows about and is flagged
        # off for.
        msg = str(e)
        if '402' in msg or 'Payment required' in msg:
            return CanaryResult(label, True, f'{model}: 402 payment-blocked (KNOWN, expected -- Cerebras flagged off pending billing fix, not a model-death signal)')
        return CanaryResult(label, False, f'{model} call failed: {e}')


def main() -> int:
    checks = [
        check_gemini('gemini-2.5-flash (video pipelines)', 'GEMINI_SOCIAL_API_KEY', 'gemini-2.5-flash'),
        check_gemini('gemini-2.5-flash-lite (article pipeline)', 'GEMINI_API_KEY', 'gemini-2.5-flash-lite'),
        check_groq('qwen/qwen3.6-27b (all 3 pipelines\' Groq fallback)', 'qwen/qwen3.6-27b'),
        check_cerebras('gpt-oss-120b (all 3 pipelines\' Cerebras fallback, flagged off)', 'gpt-oss-120b'),
    ]

    print('=== Model Canary Results ===')
    any_failed = False
    for r in checks:
        status = 'OK' if r.ok else 'FAIL'
        print(f'[{status}] {r.name}: {r.detail}')
        if not r.ok:
            any_failed = True

    print()
    if any_failed:
        print('CANARY FAILED -- at least one model/secret check failed. See details above.', file=sys.stderr)
        return 1
    print('All canary checks passed.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
