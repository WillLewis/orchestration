"""
actions/personas.py — WS-E Phase 2: LLM personas for counterparties.

In the prototype, teammates (credit officer, legal, analyst, compliance) are LLM personas that
reply asynchronously inside the work loop. The persona only produces *message text*; the loop's
control flow (who signs off, what escalates) stays deterministic and seeded, so the engine — not
the persona — still decides what is allowed.

The client is injectable: ``StubPersonaClient`` runs offline (no key) for unit tests;
``LLMPersonaClient`` routes via ``PERSONA_MODEL`` from ``.env`` for the live integration test.
"""
from __future__ import annotations

import os
from typing import Literal, Protocol, runtime_checkable

from pydantic import BaseModel

PersonaDecision = Literal["sign_off", "question", "escalate", "decline", "acknowledge"]


class Persona(BaseModel):
    """A seeded counterparty. ``stance`` is the deterministic reaction the loop applies; the
    client only colours the message text around it."""

    role: str
    display: str
    stance: PersonaDecision = "acknowledge"


class PersonaReply(BaseModel):
    """A persona's async reply to an assignment. Carries a typed decision and message text only —
    never raw sensitive content."""

    role: str
    action_index: int
    decision: PersonaDecision
    message: str = ""


@runtime_checkable
class PersonaClient(Protocol):
    """Produces a persona's reply message. Implementations must not make a pass/fail decision."""

    def generate(self, persona: Persona, prompt: str) -> str: ...


_SEED_MESSAGES: dict[PersonaDecision, str] = {
    "sign_off": "{display}: reviewed and signed off — proceed.",
    "question": "{display}: one clarification before I sign — can you confirm the figures?",
    "escalate": "{display}: this exceeds my authority; escalating to Compliance for review.",
    "decline": "{display}: declining as drafted; please revise and resend.",
    "acknowledge": "{display}: acknowledged, noted for the record.",
}


class StubPersonaClient:
    """Offline, deterministic persona client (default). Returns a canned message per stance —
    no network, no API key — so the loop is reproducible in tests."""

    def generate(self, persona: Persona, prompt: str) -> str:
        template = _SEED_MESSAGES.get(persona.stance, _SEED_MESSAGES["acknowledge"])
        return template.format(display=persona.display)


class LLMPersonaClient:
    """Opt-in persona client routed through ``PERSONA_MODEL``. Injectable; requires
    ``ANTHROPIC_API_KEY``. Not used by the offline test suite."""

    def __init__(self, model_env: str = "PERSONA_MODEL") -> None:
        from dotenv import load_dotenv

        load_dotenv()
        model = os.environ.get(model_env)
        if not model:
            raise RuntimeError(f"{model_env} is not set; cannot route persona replies.")
        self.model = model

    def generate(self, persona: Persona, prompt: str) -> str:
        from anthropic import Anthropic

        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError("ANTHROPIC_API_KEY is not set; cannot call the persona model.")
        instruction = (
            f"You are role-playing {persona.display} in a credit-committee workflow. Reply in one "
            f"or two sentences consistent with the stance '{persona.stance}'. Do not include any "
            "confidential figures or document content. Request:\n"
        )
        client = Anthropic()
        resp = client.messages.create(
            model=self.model,
            max_tokens=256,
            messages=[{"role": "user", "content": instruction + prompt}],
        )
        return resp.content[0].text.strip()


def default_personas() -> dict[str, Persona]:
    """The seeded counterparties for the Acme credit-committee scenario."""
    return {
        "credit_officer": Persona(role="credit_officer", display="Credit Officer",
                                  stance="sign_off"),
        "legal": Persona(role="legal", display="Legal", stance="escalate"),
        "analyst": Persona(role="analyst", display="Credit Analyst", stance="acknowledge"),
        "compliance": Persona(role="compliance", display="Compliance", stance="acknowledge"),
    }
