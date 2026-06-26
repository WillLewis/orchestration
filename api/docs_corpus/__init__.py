"""Docs RAG corpus package.

Phase 0 only exposes the validated corpus model. The parser/loader and seed markdown files land in
WS1.
"""

from api.docs_corpus.models import DocsDoc

__all__ = ["DocsDoc"]
