"""Safety limits for every Gemini call (Python). Mirror of scripts/lib/ai-guard.mjs.

Config: config/ai-limits.json (shared with the JS guard). Every call goes through guarded_call():
model allowlist, per-call size, then per-run caps. A refused call raises AiLimitError before anything
is sent. A cap hit sends one alert per run and raises. Usage is counts only: no prompts, no keys.
"""
from __future__ import annotations

import json
import math
import os
import sys
import atexit
import urllib.request
from pathlib import Path

_CONFIG_PATH = Path(__file__).resolve().parents[2] / 'config' / 'ai-limits.json'
CONFIG = json.loads(_CONFIG_PATH.read_text(encoding='utf-8'))


class AiLimitError(RuntimeError):
    pass


def estimate_tokens(text: str) -> int:
    return math.ceil(len(text or '') / CONFIG['charsPerToken'])


def _send_alert(subject: str, body: str) -> None:
    """Same rules as scripts/lib/alert.mjs: real send only in GitHub Actions or when forced."""
    key = os.environ.get('RESEND_API_KEY', '').lstrip('﻿').strip()
    to = os.environ.get('BRIEF_EMAIL', '').lstrip('﻿').strip()
    in_actions = os.environ.get('GITHUB_ACTIONS') == 'true'
    forced = os.environ.get('FORCE_REAL_ALERTS') == 'true'
    if not in_actions and not forced:
        print(f'[TEST MODE, alert NOT sent] {subject}', file=sys.stderr)
        return
    if not key or not to:
        print(f'ALERT (no email config): {subject}', file=sys.stderr)
        return
    payload = json.dumps({
        'from': 'Bricks of India <abhinav@bricksofindia.com>',
        'to': [to],
        'subject': subject,
        'html': f'<pre style="font-family:monospace;font-size:14px;">{body}</pre>',
    }).encode('utf-8')
    req = urllib.request.Request('https://api.resend.com/emails', data=payload, method='POST',
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        print(f'[alert] Email sent (status {resp.status})', file=sys.stderr)


_process_budgets: dict[str, dict] = {}


def _limits_for(run_name: str, scope: str | None) -> dict:
    if scope == 'request':
        return {'name': 'request', **CONFIG['requestScope']}
    found = CONFIG['perRun'].get(run_name)
    return {'name': run_name if found else 'default', **(found or CONFIG['perRun']['default'])}


def create_budget(run_name: str = 'default', scope: str | None = None, alert=None) -> dict:
    lim = _limits_for(run_name, scope)
    return {
        'name': lim['name'], 'maxCalls': lim['maxCalls'], 'maxInputTokens': lim['maxInputTokens'],
        'calls': 0, 'inputTokens': 0, 'outputTokens': 0, 'models': {}, 'alerted': False,
        'alert': alert or _send_alert,
    }


def run_budget(scope: str | None = None, run_name: str | None = None) -> dict:
    if scope == 'request':
        return create_budget(scope=scope)
    key = run_name or os.path.basename(sys.argv[0] or 'default')
    if key not in _process_budgets:
        _process_budgets[key] = create_budget(run_name=key)
    return _process_budgets[key]


def summary(budget: dict) -> dict:
    return {'run': budget['name'], 'calls': budget['calls'], 'inputTokens': budget['inputTokens'],
            'outputTokens': budget['outputTokens'], 'models': dict(budget['models'])}


def _refuse(budget: dict, reason: str):
    if not budget['alerted']:
        budget['alerted'] = True
        try:
            budget['alert'](f"AI call limit hit: {budget['name']}",
                            f"Run {budget['name']} stopped before a call: {reason}. Calls so far: {budget['calls']}. "
                            f"Input tokens so far: {budget['inputTokens']}. Output tokens so far: {budget['outputTokens']}.")
        except Exception as err:  # the alert must never hide the refusal
            print(f'[ai-guard] alert failed: {err}', file=sys.stderr)
    raise AiLimitError(reason)


def guarded_call(*, site: str, model: str, system: str, user: str, invoke, budget: dict):
    """invoke() returns a dict with 'text' and optional 'inputTokens' / 'outputTokens'."""
    if model not in CONFIG['allowedModels']:
        _refuse(budget, f'model not on the allowlist: {model}')
    site_limit = CONFIG['sites'].get(site)
    if site_limit is None:
        _refuse(budget, f'unknown call site: {site}')
    est = estimate_tokens(system) + estimate_tokens(user)
    if est > site_limit['maxInputTokensPerCall']:
        _refuse(budget, f"request too large for {site}: about {est} input tokens, limit {site_limit['maxInputTokensPerCall']}")
    if budget['calls'] + 1 > budget['maxCalls']:
        _refuse(budget, f"call cap reached: {budget['maxCalls']} calls per run")
    if budget['inputTokens'] + est > budget['maxInputTokens']:
        _refuse(budget, f"input token cap reached: {budget['maxInputTokens']} per run")
    # Count the attempt before sending, so a failed request still counts against the caps.
    budget['calls'] += 1
    budget['models'][model] = budget['models'].get(model, 0) + 1
    budget['inputTokens'] += est
    res = invoke()
    if isinstance(res.get('inputTokens'), int):
        budget['inputTokens'] += res['inputTokens'] - est
    if isinstance(res.get('outputTokens'), int):
        budget['outputTokens'] += res['outputTokens']
    return res


def report_at_exit(budget: dict) -> None:
    def _print():
        if budget['calls'] > 0:
            print('[ai-usage] ' + json.dumps(summary(budget)), file=sys.stderr)
    atexit.register(_print)


def gemini_generate(client, *, site: str, model: str, system: str, user: str, config=None, budget: dict | None = None):
    """The one way Python code calls Gemini. Returns {'response', 'text', 'inputTokens', 'outputTokens'}.

    system: the system text (counted for the size limit; the caller still passes it in config).
    user: the prompt contents. Refusals raise AiLimitError before any request is sent.
    """
    budget = budget or run_budget()

    def invoke():
        kwargs = {'model': model, 'contents': user}
        if config is not None:
            kwargs['config'] = config
        resp = client.models.generate_content(**kwargs)
        usage = getattr(resp, 'usage_metadata', None)
        return {
            'response': resp,
            'text': resp.text or '',
            'inputTokens': getattr(usage, 'prompt_token_count', None) if usage else None,
            'outputTokens': getattr(usage, 'candidates_token_count', None) if usage else None,
        }

    return guarded_call(site=site, model=model, system=system, user=user, invoke=invoke, budget=budget)
