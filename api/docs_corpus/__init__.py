"""Docs RAG corpus package."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from api.docs_corpus.models import DocsChunk, DocsDoc

_ROOT = Path(__file__).parent
_PAGES = _ROOT / "generated" / "pages.json"


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


def load_chunks(pages_path: Path | None = None) -> list[DocsChunk]:
    """Load ACL-safe docs chunks without changing the legacy `load_docs()` shape."""
    chunks: list[DocsChunk] = []
    for doc in load_docs():
        chunks.extend(_chunks_for_doc(doc))
    chunks.extend(_page_chunks(pages_path or _PAGES))
    return chunks


def _chunks_for_doc(doc: DocsDoc) -> list[DocsChunk]:
    if doc.access == "locked":
        return [_chunk(doc, section=_visible_title(doc), anchor=None, text="")]
    if doc.access == "sealed":
        return [
            _chunk(
                doc,
                section=_visible_title(doc),
                anchor=None,
                text=doc.cleared_derivative or "",
            )
        ]

    sections = _markdown_sections(doc.body)
    if not sections:
        return [_chunk(doc, section=_visible_title(doc), anchor=None, text=doc.body)]

    chunks: list[DocsChunk] = []
    seen: dict[str, int] = {}
    for idx, (heading, text) in enumerate(sections):
        clean_text = text.strip()
        if not clean_text:
            continue
        anchor = _slugify(heading, seen)
        chunks.append(_chunk(doc, section=heading, anchor=anchor, text=clean_text, index=idx))
    if chunks:
        return chunks
    return [_chunk(doc, section=_visible_title(doc), anchor=None, text=doc.body)]


def _chunk(
    doc: DocsDoc,
    *,
    section: str | None,
    anchor: str | None,
    text: str,
    index: int = 0,
) -> DocsChunk:
    suffix = anchor or str(index)
    return DocsChunk(
        doc_id=doc.id,
        chunk_id=f"{doc.id}#{suffix}",
        title=doc.title,
        route=doc.route,
        anchor=anchor,
        section=section,
        in_nav=doc.in_nav,
        viewer_permitted=doc.viewer_permitted,
        title_visibility=doc.title_visibility,
        owner=doc.owner,
        request_access_to=doc.request_access_to,
        text=text,
        access=doc.access,
        tier=doc.tier,
        source="curated",
    )


def _page_chunks(path: Path) -> list[DocsChunk]:
    if not path.exists():
        return []
    records = json.loads(path.read_text())
    if not isinstance(records, list):
        return []

    chunks: list[DocsChunk] = []
    for record in records:
        if not isinstance(record, dict):
            continue
        doc_id = str(record.get("id") or "").strip()
        title = str(record.get("title") or doc_id).strip()
        route = record.get("route")
        sections = record.get("sections")
        if not doc_id or not isinstance(sections, list):
            continue
        for idx, section in enumerate(sections):
            chunk = _page_section_chunk(doc_id, title, route, section, idx)
            if chunk is not None:
                chunks.append(chunk)
    return chunks


def _page_section_chunk(
    doc_id: str,
    title: str,
    route: Any,
    section: Any,
    index: int,
) -> DocsChunk | None:
    if not isinstance(section, dict):
        return None
    heading = str(section.get("heading") or "").strip()
    anchor = str(section.get("anchor") or "").strip()
    text = str(section.get("text") or "").strip()
    if not heading or not anchor or not text:
        return None
    return DocsChunk(
        doc_id=doc_id,
        chunk_id=f"{doc_id}#{anchor}",
        title=title,
        route=str(route) if route else None,
        anchor=anchor,
        section=heading,
        in_nav=True,
        viewer_permitted=True,
        title_visibility="reveal",
        owner="Docs",
        request_access_to=None,
        text=text,
        access="open",
        tier=1,
        source="generated_page",
    )


def _markdown_sections(text: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    current_heading: str | None = None
    current_body: list[str] = []
    for line in text.splitlines():
        match = re.match(r"^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$", line)
        if match:
            if current_heading is not None:
                sections.append((current_heading, "\n".join(current_body).strip()))
            current_heading = match.group(1).strip()
            current_body = []
        else:
            current_body.append(line)
    if current_heading is not None:
        sections.append((current_heading, "\n".join(current_body).strip()))
    return sections


def _slugify(value: str, seen: dict[str, int]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "section"
    count = seen.get(base, 0)
    seen[base] = count + 1
    return base if count == 0 else f"{base}-{count}"


def _visible_title(doc: DocsDoc) -> str | None:
    return doc.title if doc.title_visibility == "reveal" else None


__all__ = ["DocsChunk", "DocsDoc", "load_chunks", "load_docs", "parse_doc"]
