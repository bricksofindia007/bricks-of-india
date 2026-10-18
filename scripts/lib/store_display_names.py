"""Display name for each store slug, read from config/store-display-names.json (the TypeScript side reads the same file).

The stores table is the source of truth; a test checks the file against its seed. An unknown slug shows as itself.
"""
import json
from pathlib import Path

_PATH = Path(__file__).resolve().parents[2] / "config" / "store-display-names.json"


def _load() -> dict:
    with _PATH.open(encoding="utf-8") as f:
        raw = json.load(f)
    return {k: v for k, v in raw.items() if not k.startswith("_")}


STORE_DISPLAY_NAMES = _load()


def store_display_name(slug: str) -> str:
    return STORE_DISPLAY_NAMES.get(slug, slug)
