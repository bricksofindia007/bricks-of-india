"""G19 (CLAUDE.md, 1 Oct 2026): nothing public may reveal how Bricks of India works.

Python side of the one term list (config/g19-terms.json), shared with the TypeScript
lint gate (src/lib/g19.ts) and the CI public-text check (scripts/ci/g19-check.mjs).
Used by the video script prompts/gates and the Instagram caption writer.
"""
import json
import re
from pathlib import Path

_CFG = json.loads((Path(__file__).resolve().parent / 'g19-terms.json').read_text(encoding='utf-8'))
_TERMS = [(cat, re.compile(p, re.IGNORECASE)) for cat, pats in _CFG['terms'].items() for p in pats]
_ALLOW = [re.compile(p, re.IGNORECASE) for p in _CFG['allow']]

# Same wording as src/lib/g19.ts G19_PROMPT_RULE.
PROMPT_RULE = (
    'NEVER describe how Bricks of India works. Do not mention scraping, scrapers, bots, feeds, APIs, Shopify, '
    'how often prices update (no "every 6 hours", "daily", "real-time"), automation, AI or language models, '
    'model or provider names, pipelines, quality gates, pricing formulas, MRP anchor rules or which store sets the MRP, '
    'rate limits, infrastructure, or internal tools. Say what the reader gets ("Toycra has it at ₹X"), never how we get it.'
)


def g19_hits(text: str) -> list[dict]:
    """Sentences of `text` containing a G19 term (allowed phrases removed first)."""
    hits = []
    for raw in re.split(r'(?<=[.!?])\s+|\n+', text or ''):
        raw = raw.strip()
        if not raw:
            continue
        s = raw
        for allow in _ALLOW:
            s = allow.sub(' ', s)
        for cat, rx in _TERMS:
            m = rx.search(s)
            if m:
                hits.append({'category': cat, 'term': m.group(0), 'sentence': raw[:200]})
                break
    return hits
