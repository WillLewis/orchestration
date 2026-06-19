"""WS-B — permission-aware context assembly (`core.pipeline.ContextAssembler`)."""
from context.assembler import (
    FINANCE_CREDIT_RECIPE,
    CandidateClaim,
    ClaimExtractor,
    DeclaredConflict,
    DeclaredRelation,
    EvidenceRequirement,
    HeuristicClaimExtractor,
    LLMClaimExtractor,
    PermissionAwareContextAssembler,
    PermissionPolicy,
    Recipe,
    assemble_acme_demo,
)

__all__ = [
    "FINANCE_CREDIT_RECIPE",
    "CandidateClaim",
    "ClaimExtractor",
    "DeclaredConflict",
    "DeclaredRelation",
    "EvidenceRequirement",
    "HeuristicClaimExtractor",
    "LLMClaimExtractor",
    "PermissionAwareContextAssembler",
    "PermissionPolicy",
    "Recipe",
    "assemble_acme_demo",
]
