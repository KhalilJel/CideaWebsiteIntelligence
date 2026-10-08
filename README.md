# Cidea Website Intelligence

AI-powered website research, auditing and improvement engine for Cidea.

## Role

Gullkornet finds the customer. Cidea Website Intelligence finds what Cidea can sell the customer.

## Pipeline

Hermes → Firecrawl / Agent Reach / JEV / PixelJury → TypeSafe → specialist audits → Improvement Director → coding agent → re-audit → human approval.

## Rules

- Evidence before recommendations.
- No automatic production deployment in the initial phase.
- Never modify DNS or MX.
- Keep Cidea Lead, Marketing and Consulting strategically distinct.
- Research once and reuse evidence where appropriate.

## Validation

Every implementation step is documented in GitHub and gated by typecheck and automated tests before the next integration step.

## Status

Prototype foundation. The research, browser validation and evidence-to-improvement layers are implemented. The service is intentionally scoped to website intelligence only.

Railway architecture:

- `cidea-website-intelligence` is a dedicated service for website research, auditing and improvement recommendations.
- `keelead` is a separate service for lead discovery, enrichment, verification and company research.
- `hermes-agent` remains the orchestration/runtime layer.
- These services remain in the same Railway project (`powerful-patience`) to keep infrastructure simple. A separate Railway project is not required at this stage.

Boundary rule:

Cidea Website Intelligence does not become the lead generation engine. Gullkornet/KeeLead finds and enriches prospects; this service evaluates their websites and produces evidence-backed opportunities that Cidea can sell. No DNS or MX changes are part of this service.

## Research Layer

Firecrawl is optional and Agent Reach is an isolated CLI capability adapter. Both remain disabled unless explicitly configured.

## Improvement Layer

Deterministic specialist findings are converted into ranked P0–P3 improvement actions according to the selected Cidea target. Every generated action carries source evidence, confidence and human approval requirements.
