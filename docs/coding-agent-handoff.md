# Improvement Director → Coding Agent

The Improvement Director produces prioritized improvement actions. The coding task generator converts the selected top five actions into validated CodingTask objects.

## Flow

Audit evidence → Hermes → Improvement Director → CodingTask → AI coding agent → PR → CI → PixelJury re-audit → human approval → deployment.

## CodingTask contract

Each task contains the target website, source improvement action, priority, category, evidence, proposed change, expected outcome, acceptance criteria, verification commands and explicit non-goals.

## Agent

Cursor Agent is the practical coding agent for this repository because it can work directly in the local Git checkout. The repository remains the source of truth.

## Guardrails

- Human approval is mandatory.
- Never deploy automatically.
- Never modify DNS or MX.
- Prefer PRs over direct changes to main.
- Run typecheck and tests before review.
- Re-run PixelJury after UI changes.
- Do not invent evidence or findings.
