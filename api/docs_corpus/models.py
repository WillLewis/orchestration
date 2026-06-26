"""Docs RAG corpus models.

Kept outside the finance `corpus/` package. Phase 0 freezes the shape only; WS1 adds the
frontmatter parser, loader, and seed markdown.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field

from api.models import DocsAccess

DocsTitleVisibility = Literal["reveal", "redact"]
DocsDocTier = Literal[1, 2, "sealed", 3]


class DocsDoc(BaseModel):
    """Validated docs corpus record.

    Frontmatter may include `seal: true`, but the public `seal`, `tier`, and `access` values are
    computed from permission metadata so a seed file cannot hand-author an inconsistent tier.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    route: Optional[str] = None
    in_nav: bool = False
    viewer_permitted: bool = False
    title_visibility: DocsTitleVisibility = "reveal"
    owner: str = ""
    request_access_to: Optional[str] = None
    body: str = ""
    cleared_derivative: Optional[str] = None
    seal_requested: bool = Field(default=False, validation_alias="seal", exclude=True)

    @computed_field
    @property
    def seal(self) -> bool:
        return bool(self.seal_requested and not self.viewer_permitted)

    @computed_field
    @property
    def tier(self) -> DocsDocTier:
        if self.seal:
            return "sealed"
        if not self.viewer_permitted:
            return 3
        if self.in_nav:
            return 1
        return 2

    @computed_field
    @property
    def access(self) -> DocsAccess:
        if self.seal:
            return "sealed"
        if not self.viewer_permitted:
            return "locked"
        return "open"


DocsChunkSource = Literal["curated", "generated_page"]


class DocsChunk(BaseModel):
    """ACL-safe retrieval unit.

    `text` is the only body-like field the chat path may hand to a model. It is already permission
    projected by the loader: open chunks contain source text, sealed chunks contain only the cleared
    derivative, and locked chunks contain an empty string.
    """

    doc_id: str
    chunk_id: str
    title: str
    route: Optional[str] = None
    anchor: Optional[str] = None
    section: Optional[str] = None
    in_nav: bool = False
    viewer_permitted: bool = False
    title_visibility: DocsTitleVisibility = "reveal"
    owner: str = ""
    request_access_to: Optional[str] = None
    text: str = ""
    access: DocsAccess = "open"
    tier: DocsDocTier
    source: DocsChunkSource = "curated"
