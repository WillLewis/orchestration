# telemetry/ — WS-G (Codex)

Privacy-preserving telemetry: typed event extraction, client-side redaction, k-anonymity
aggregation thresholds, differential-privacy noise on aggregates. NEVER emits raw content
(enforced by `TelemetryEvent` schema `extra="forbid"`). DoD: redaction + DP aggregate tests green.

## Docs-chat LLM observability

`telemetry.docs_chat` adds an in-process aggregate summary for `/docs/chat`. It captures only
categorical counters:

- surface
- requested phrasing mode
- effective phrasing mode
- fallback reason
- response status
- model configured yes/no
- citation count bucket
- latency bucket
- derived LLM requested/accepted/fallback totals
- no-results total

It does not capture raw prompts, raw responses, raw documents, retrieved chunk text, snippets,
history, user messages, doc ids, model names, secrets, or per-user trace content. The signal and
summary Pydantic models forbid extra fields, and tests assert that raw-content field names cannot
enter the telemetry shape.
