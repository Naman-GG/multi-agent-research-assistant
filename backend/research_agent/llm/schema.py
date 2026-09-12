"""Convert a pydantic model into the schema subset Gemini's response_schema accepts.

Gemini takes a trimmed OpenAPI 3.0 schema, not full JSON Schema. Pydantic emits
`additionalProperties`, `$defs`/`$ref`, `title` and `anyOf`, and the API rejects the
request outright when it sees them -- a 400, not a warning. Our models use
`extra="forbid"`, so every one of them emits `additionalProperties: false`.

This inlines refs and keeps only the keys Gemini understands.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel

# keys Gemini's response_schema recognises
_ALLOWED = {
    "type", "format", "description", "nullable", "enum",
    "items", "properties", "required", "propertyOrdering",
}


def _resolve(node: Any, defs: dict[str, Any], depth: int = 0) -> Any:
    if depth > 25 or not isinstance(node, dict):
        return node

    if "$ref" in node:
        name = node["$ref"].rsplit("/", 1)[-1]
        return _resolve(defs.get(name, {}), defs, depth + 1)

    # Optional[X] arrives as anyOf: [X, {"type": "null"}] -> X with nullable
    if "anyOf" in node:
        variants = [v for v in node["anyOf"] if v.get("type") != "null"]
        nullable = len(variants) < len(node["anyOf"])
        base = _resolve(variants[0], defs, depth + 1) if variants else {"type": "string"}
        if nullable and isinstance(base, dict):
            base = {**base, "nullable": True}
        if desc := node.get("description"):
            base = {**base, "description": desc}
        return base

    out: dict[str, Any] = {}
    for key, value in node.items():
        if key not in _ALLOWED:
            continue
        if key == "properties":
            out[key] = {k: _resolve(v, defs, depth + 1) for k, v in value.items()}
        elif key == "items":
            out[key] = _resolve(value, defs, depth + 1)
        else:
            out[key] = value

    # a schema with no type but with properties is an object
    if "properties" in out and "type" not in out:
        out["type"] = "object"
    return out


def to_gemini_schema(model: type[BaseModel]) -> dict[str, Any]:
    raw = model.model_json_schema()
    return _resolve(raw, raw.get("$defs", {}))
