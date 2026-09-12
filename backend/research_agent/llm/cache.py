"""Content-addressed disk cache: sha256(model + prompt + schema) -> response.

This is the single most important piece of free-tier survival. Re-running the same
question during development costs zero quota, and it is what makes `cli.py replay`
possible on demo day.

TODO(Track A): implement get/set over a directory of JSON files under settings.cache_dir.
"""
from __future__ import annotations

import hashlib


def cache_key(model: str, prompt: str, schema_name: str = "") -> str:
    return hashlib.sha256(f"{model}\x00{prompt}\x00{schema_name}".encode()).hexdigest()


def get(key: str) -> str | None:
    raise NotImplementedError("TODO(Track A)")


def put(key: str, value: str) -> None:
    raise NotImplementedError("TODO(Track A)")
