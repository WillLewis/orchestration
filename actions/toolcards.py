"""
actions/toolcards.py — WS-E Phase 1 (deterministic).

The typed tool registry the composer maps proposed work onto. A ``ToolCard`` declares a tool's
*side-effect class* (read · draft · propose · write) and input schema — the deterministic engine,
not the LLM, decides whether an action built from a card is allowed to run (see ``engine.py``).
"""
from __future__ import annotations

from core.schemas import SideEffectClass, ToolCard


def default_toolcards() -> list[ToolCard]:
    """The five tools the work loop can propose. Side-effect classes follow the plan's
    capability ladder (read · draft · propose · write-with-approval)."""
    return [
        ToolCard(
            name="create_task",
            description="Create a follow-up task (e.g. upload a missing document).",
            side_effect=SideEffectClass.write,
            input_schema={"title": "str", "assignee": "str", "status": "str"},
        ),
        ToolCard(
            name="update_project_status",
            description="Advance a project/approval workflow to a new status.",
            side_effect=SideEffectClass.write,
            input_schema={"target_object_id": "str", "status": "str"},
            requires_approver=None,
        ),
        ToolCard(
            name="route_approval",
            description="Route an approval packet to a required approver and record sign-off.",
            side_effect=SideEffectClass.propose,
            input_schema={"approver_role": "str", "packet": "str"},
        ),
        ToolCard(
            name="draft_internal_note",
            description="Draft an internal note (e.g. on open risks or a conflict).",
            side_effect=SideEffectClass.draft,
            input_schema={"topic": "str", "body": "str"},
        ),
        ToolCard(
            name="schedule_meeting",
            description="Propose a follow-up meeting to unblock unresolved items.",
            side_effect=SideEffectClass.propose,
            input_schema={"topic": "str", "attendees": "list[str]"},
        ),
        ToolCard(
            name="edit_document",
            description="Apply a targeted, human-approved edit to reconcile a source document.",
            side_effect=SideEffectClass.write,
            input_schema={"target_object_id": "str", "after": "dict"},
        ),
    ]


class ToolCardRegistry:
    """Lookup of the tools the composer may map onto. Defaults to ``default_toolcards``."""

    def __init__(self, cards: list[ToolCard] | None = None) -> None:
        self._cards: dict[str, ToolCard] = {c.name: c for c in (cards or default_toolcards())}

    def get(self, name: str) -> ToolCard:
        if name not in self._cards:
            raise KeyError(f"unknown tool '{name}'; registered: {sorted(self._cards)}")
        return self._cards[name]

    def register(self, card: ToolCard) -> None:
        self._cards[card.name] = card

    def names(self) -> list[str]:
        return sorted(self._cards)

    def all(self) -> list[ToolCard]:
        return [self._cards[n] for n in self.names()]

    def __contains__(self, name: object) -> bool:
        return name in self._cards
