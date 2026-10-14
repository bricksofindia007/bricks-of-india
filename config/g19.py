"""G19 (CLAUDE.md, 1 Oct 2026): nothing public may reveal how Bricks of India works.

Python side of src/lib/g19.ts, used by the video script prompts/gates and the Instagram
caption writer. The term list is NOT in the repo (A3, 1 Oct 2026): it is the G19_TERMS
secret (JSON {"terms": {category: [regex]}, "allow": [regex], "prompt_rule": str}), read at
run time. Hits never carry the matched words, so logs don't rebuild the list.
"""
import json
import os
import re

PROMPT_FALLBACK = (
    'NEVER describe how Bricks of India works or is run. '
    'Say what the reader gets ("Toycra has it at ₹X"), never how we get it.'
)


def _load():
    raw = (os.environ.get('G19_TERMS') or '').lstrip('﻿').strip()
    if not raw:
        return None
    try:
        cfg = json.loads(raw)
        terms = [(cat, re.compile(p, re.IGNORECASE)) for cat, pats in cfg['terms'].items() for p in pats]
        allow = [re.compile(p, re.IGNORECASE) for p in cfg.get('allow', [])]
        return {'terms': terms, 'allow': allow, 'rule': cfg.get('prompt_rule')}
    except (ValueError, KeyError, TypeError, re.error):
        return None


_CFG = _load()
PROMPT_RULE = (_CFG or {}).get('rule') or PROMPT_FALLBACK


def g19_configured() -> bool:
    return _CFG is not None


def g19_hits(text: str):
    """Indexes of sentences in `text` that describe how the site works, or None when the
    term list isn't configured (callers fail closed)."""
    if _CFG is None:
        return None
    hits = []
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+|\n+', text or '') if s.strip()]
    for i, raw in enumerate(sentences):
        s = raw
        for allow in _CFG['allow']:
            s = allow.sub(' ', s)
        if any(rx.search(s) for _, rx in _CFG['terms']):
            hits.append({'index': i})
    return hits
