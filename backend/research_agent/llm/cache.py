"""Content-addressed disk cache: sha256(model + prompt + schema) -> response.

The single most important piece of free-tier survival. Re-running the same question
during development costs zero quota, and it is what makes `cli.py replay` work on
demo day.

One JSON file per entry, sharded two levels deep so a few thousand entries do not
land in one directory. Cache reads never raise: a corrupt or unreadable entry is a
miss, not a crash -- a broken cache must degrade to "slow", never to "down".
"""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path


def cache_key(model: str, prompt: str, schema_name: str = "") -> str:
    """Stable key. Changing the prompt, the model, or the output schema misses."""
    return hashlib.sha256(f"{model}\x00{prompt}\x00{schema_name}".encode()).hexdigest()


class DiskCache:
    def __init__(self, directory: str | Path) -> None:
        self.dir = Path(directory)

    def _path(self, key: str) -> Path:
        return self.dir / key[:2] / key[2:4] / f"{key}.json"

    def get(self, key: str) -> str | None:
        try:
            return json.loads(self._path(key).read_text())["response"]
        except (OSError, ValueError, KeyError):
            return None

    def put(self, key: str, value: str, *, model: str = "", prompt: str = "") -> None:
        """Write atomically -- a half-written entry read by a parallel agent would
        otherwise poison the cache for the rest of the run."""
        path = self._path(key)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            payload = json.dumps({"model": model, "prompt": prompt, "response": value})
            fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
            with os.fdopen(fd, "w") as f:
                f.write(payload)
            os.replace(tmp, path)
        except OSError:
            pass  # a cache that cannot write is slow, not broken

    def stats(self) -> dict[str, int]:
        try:
            return {"entries": sum(1 for _ in self.dir.rglob("*.json"))}
        except OSError:
            return {"entries": 0}
