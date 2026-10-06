# Cidea Website Intelligence

AI-powered website research, auditing and improvement engine for Cidea.

## Role

Gullkornet finds the customer. Cidea Website Intelligence finds what Cidea can sell the customer.

## Pipeline

Hermes → Firecrawl / Agent Reach / JEV → TypeSafe → specialist audits → Improvement Director → coding agent → re-audit → human approval.

## Rules

- Evidence before recommendations.
- No automatic production deployment in the initial phase.
- Never modify DNS or MX.
- Keep Cidea Lead, Marketing and Consulting strategically distinct.
- Research once and reuse evidence where appropriate.

## Validation

Every implementation step is documented in GitHub and gated by typecheck and automated tests before the next integration step.

## Status

Prototype foundation. The research, browser validation and evidence-to-improvement layers are implemented. Live external/browser runtimes must be configured before use.

## Research Layer

Firecrawl is optional and Agent Reach is an isolated CLI capability adapter. Both remain disabled unless explicitly configured.

## Improvement Layer

Deterministic specialist findings are converted into ranked P0–P3 improvement actions according to the selected Cidea target. Every generated action carries source evidence, confidence and human approval requirements.
