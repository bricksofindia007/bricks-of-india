"""Literal rework: keep the original spoken segments word for word and replace only the verdict text.

No script-generation model call is made here. The segments come from a file in the repository (the
original generation of the video). Only the verdict segment's text changes, to the text given (the row's
rejection reason). Every other check still applies: the same word-budget check as script generation, with
an explicit extra allowance that defaults to 0 (so the cap stays at 16 unless a reviewed run sets it).
The duration and sound-tag gates, the price token and the banned-construction checks run later in the
normal render path, unchanged.
"""
import copy
import json
from pathlib import Path

VERDICT_PREFIX = 'verdict:'


def load_segments(path) -> list:
    """Read the original segments from a JSON file (a list, or an object with a 'segments' list)."""
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    segments = data['segments'] if isinstance(data, dict) else data
    if not isinstance(segments, list) or not segments:
        raise ValueError('the segments file has no segments')
    for seg in segments:
        if not isinstance(seg, dict) or 'text' not in seg:
            raise ValueError('every segment needs a text field')
    return segments


def verdict_indexes(segments: list) -> list:
    """Indexes of the spoken segments that start with the verdict label."""
    return [
        i for i, seg in enumerate(segments)
        if seg.get('voice', True) and str(seg.get('text', '')).strip().lower().startswith(VERDICT_PREFIX)
    ]


def replace_verdict(segments: list, verdict_text: str) -> list:
    """Return a copy of the segments with only the verdict segment's text replaced.

    The verdict text must start with 'Verdict:'. Exactly one spoken verdict segment must exist.
    Every other segment is copied unchanged (text, voice flag and sound tag).
    """
    text = (verdict_text or '').strip()
    if not text.lower().startswith(VERDICT_PREFIX):
        raise ValueError('the verdict text must start with "Verdict:"')
    found = verdict_indexes(segments)
    if len(found) != 1:
        raise ValueError(f'expected exactly one verdict segment, found {len(found)}')
    out = copy.deepcopy(segments)
    out[found[0]]['text'] = text
    return out


def check_literal_budget(segments: list, price_inr, extra_total_words: int = 0) -> dict:
    """The same validation and word-budget check as script generation, with an explicit extra allowance.

    Raises WordBudgetExceededError (the generator's own error) when the budget is not met.
    """
    from quiet_panic_script_gen import WordBudgetExceededError, _validate_segments, check_word_budget
    _validate_segments(segments)
    budget = check_word_budget(segments, price_inr, extra_total_words=extra_total_words)
    if not budget['pass']:
        raise WordBudgetExceededError(budget['detail'], segments=segments, budget=budget)
    return budget
