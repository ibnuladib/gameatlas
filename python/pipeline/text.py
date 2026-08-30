"""HTML / whitespace normalization used by clean and embed document building."""

from __future__ import annotations

import re
from html import unescape

_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")


def strip_html(text: str | None) -> str:
    if not text:
        return ""
    value = unescape(text)
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = _TAG.sub(" ", value)
    return _SPACE.sub(" ", value).replace("\n ", "\n").strip()


def join_capped(parts: list[str], cap: int) -> str:
    document = " ".join(p for p in parts if p).strip()
    if len(document) <= cap:
        return document
    return document[: cap - 1].rsplit(" ", 1)[0] + "…"
