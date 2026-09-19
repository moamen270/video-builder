"""Performance tags in `speech` — `[laugh]`, `[chuckle]`, `[cough]` — are spoken by Chatterbox Turbo but must
never reach captions or the aligner. One regex, shared by the Python engine and mirrored in engine/src (TAG_RE)."""
from __future__ import annotations

import re

# Only the tags Chatterbox Turbo documents. Anything else in brackets is left alone (it is text).
TAGS = ("laugh", "chuckle", "cough")
TAG_RE = re.compile(r"\[(?:" + "|".join(TAGS) + r")\]", re.IGNORECASE)


def has_tags(text: str) -> bool:
    return bool(TAG_RE.search(text))


def strip_tags(text: str) -> str:
    """Remove tags and collapse the whitespace they leave behind."""
    return re.sub(r"\s{2,}", " ", TAG_RE.sub(" ", text)).strip()
