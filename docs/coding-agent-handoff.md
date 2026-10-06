# Improvement Director → Coding Agent

This document defines the safe handoff from audit findings to an AI coding agent.

## Flow

Audit evidence → Improvement Director → coding task → AI coding agent → PR → CI → PixelJury re-audit → human approval → deployment.

## Guardrails

- Never deploy automatically.
- Never modify DNS or MX.
- Prefer a PR over direct changes to main.
- Preserve the strategic distinction between Cidea Lead, Cidea Marketing, and Cidea Consulting.
- Require typecheck and tests before review.
- Re-run PixelJury after UI changes.
- Treat audit evidence as the source of truth. Do not invent findings.

## Coding task contract

A coding task should contain:

1. Target website
2. Business purpose
3. Priority
4. Evidence
5. Expected outcome
6. Acceptance criteria
7. Files/components likely affected
8. Verification commands
9. Explicit non-goals

## Recommended agent

Cursor Agent is the practical coding agent for this repository because it can work directly in the local Git checkout and open the resulting PR. The repository should remain the source of truth.

## First implementation target

Start with the highest-confidence visual issues from PixelJury's deterministic checks:

- Body text below 14px
- Contrast below WCAG AA target
- Interactive targets below 44px
- Repeated card patterns where simplification is appropriate

These are candidate tasks, not automatic approvals. Human review remains required before merge/deploy.
