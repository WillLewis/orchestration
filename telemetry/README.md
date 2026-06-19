# telemetry/ — WS-G (Codex)
Privacy-preserving telemetry: typed event extraction, client-side redaction, k-anonymity
aggregation thresholds, differential-privacy noise on aggregates. NEVER emits raw content
(enforced by `TelemetryEvent` schema `extra="forbid"`). DoD: redaction + DP aggregate tests green.
