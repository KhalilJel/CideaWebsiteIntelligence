# Cursor Agent integration

## Purpose

The Website Intelligence pipeline now produces a validated CodingTask after Understand, Imagine and Decide.

This integration is the execution boundary between that structured task and Cursor Agent.

## Runtime contract

The integration uses Cursor's headless CLI:

`agent -p "<prompt>" --output-format json --workspace "<workspace>"`

The workspace is supplied by the caller. The adapter does not:

- create or merge Git branches
- open or merge pull requests
- deploy production
- modify DNS or MX
- bypass human approval

The caller remains responsible for branch lifecycle and PR review.

## Prompt contract

Every Cursor prompt includes:

- Cidea business objective
- evidence-backed problem
- selected alternative
- Hermes decision reasoning
- evidence URLs
- acceptance criteria
- verification commands
- non-goals and safety boundaries

This prevents Cursor from receiving vague instructions such as "make the cards better."

## Authentication

Cursor CLI supports browser login for interactive use and API key authentication for automation. Authentication is intentionally not stored in this repository.

For automation, configure Cursor credentials in the runtime environment rather than in GitHub source files.

## Execution model

The current adapter is headless and synchronous from the caller's perspective:

1. Build a prompt from a validated CodingTask.
2. Spawn Cursor Agent without a shell.
3. Capture stdout and stderr.
4. Enforce a timeout.
5. Parse JSON output when available.
6. Return the execution result to the caller.

The next step is to connect this adapter to the branch/PR orchestration layer. Production deployment remains human-approved.

## Why CLI first

Cursor also exposes ACP over stdio for custom clients. ACP is more suitable when we need streaming sessions, permission negotiation or long-lived agent sessions. The first Website Intelligence execution path only needs deterministic task submission and result capture, so the headless CLI keeps the integration smaller and easier to validate.
