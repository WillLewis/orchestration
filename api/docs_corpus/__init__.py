"""Docs RAG corpus package."""
from __future__ import annotations

from pathlib import Path

from api.docs_corpus.models import DocsDoc

_ROOT = Path(__file__).parent


def _scalar(value: str) -> str | bool | None:
    value = value.strip()
    if value == "null":
        return None
    if value in {"true", "false"}:
        return value == "true"
    return value.removeprefix('"').removesuffix('"')


def parse_doc(text: str) -> DocsDoc:
    _, frontmatter, _ = text.split("---", 2)
    fields: dict[str, str | bool | None] = {}
    body: list[str] = []
    in_body = False
    for line in frontmatter.splitlines():
        if in_body:
            body.append(line[2:] if line.startswith("  ") else line)
            continue
        key, _, value = line.partition(":")
        if key == "body" and value.strip() == "|":
            in_body = True
        elif key:
            fields[key] = _scalar(value)
    fields["body"] = "\n".join(body).strip()
    return DocsDoc.model_validate(fields)


def load_docs() -> list[DocsDoc]:
    return [parse_doc(path.read_text()) for path in sorted(_ROOT.glob("*.md"))]


__all__ = ["DocsDoc", "load_docs", "parse_doc"]
