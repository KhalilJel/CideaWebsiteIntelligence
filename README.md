# Website Intelligence Engine

AI-powered website research, auditing and improvement engine for Cidea.

## Role

Gullkornet finds the customer. Website Intelligence Engine finds what Cidea can sell the customer.

## Pipeline

Hermes → Firecrawl / Agent Reach / JEV / PixelJury → TypeSafe → specialist audits → Improvement Director → coding agent → re-audit → human approval.

## Rules

- Evidence before recommendations.
- No automatic production deployment in the initial phase.
- Never modify DNS or MX.
- Keep Cidea Lead, Marketing and Consulting strategically distinct.
- Research once and reuse evidence where appropriate.

## Validation

Cursor proposals are tested in a temporary clone of the target website repository. The engine installs dependencies, runs the website build, starts a local preview, and directs visual/browser validation to that preview while it is running. The live website is not used as a substitute for validating the changed code.

A successful build is not the same as approval. High-severity visual findings, failed browser checks, or missing required validation keep the proposal from approval. Human approval is required before any proposed change is applied to production.

See [`docs/isolated-preview-validation.md`](docs/isolated-preview-validation.md) for the validation contract and known limitations.

## Status

Prototype in active completion. Isolated workspace build and preview validation are being added. JEV is not ready until a real browser service is configured and safely able to access the preview. Durable storage of proposed diffs and review evidence is implemented against PostgreSQL, but the Railway `DATABASE_URL` reference still needs to be configured and tested before it is active. The service remains scoped to website intelligence only.

Railway architecture:

- `cidea-website-intelligence` is a dedicated service for website research, auditing and improvement recommendations.
- `keelead` is a separate service for lead discovery, enrichment, verification and company research.
- `hermes-agent` remains the orchestration/runtime layer.
- These services remain in the same Railway project (`powerful-patience`) to keep infrastructure simple. A separate Railway project is not required at this stage.

Boundary rule:

Website Intelligence Engine does not become the lead generation engine. Gullkornet/KeeLead finds and enriches prospects; this service evaluates their websites and produces evidence-backed opportunities that Cidea can sell. No DNS or MX changes are part of this service.

## Research Layer

Firecrawl is optional and Agent Reach is an isolated CLI capability adapter. Both remain disabled unless explicitly configured.

## Improvement Layer

Deterministic specialist findings are converted into ranked P0–P3 improvement actions according to the selected Cidea target. Every generated action carries source evidence, confidence and human approval requirements.
