"""Prompt loading. Prompts live in prompts/*.md, not in string literals.

Keeping them as files means they diff cleanly in review, and the prompt-tuning history
is visible in git -- which is itself material for the methodology chapter.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

_DIR = Path(__file__).parent / "prompts"


@lru_cache(maxsize=None)
def _template(name: str) -> str:
    return (_DIR / f"{name}.md").read_text()


def render(name: str, **values: object) -> str:
    """Load prompts/<name>.md and substitute {placeholders}.

    Uses str.replace rather than str.format because paper text routinely contains
    braces -- chemical formulae, LaTeX fragments, code -- and .format would choke
    on them or silently mangle the source text we are about to ask for quotes from.
    """
    text = _template(name)
    for key, value in values.items():
        text = text.replace("{" + key + "}", str(value))
    return text
