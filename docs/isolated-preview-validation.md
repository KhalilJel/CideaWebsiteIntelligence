# Isolated Preview Validation

## Purpose

Every Cursor proposal must be validated against the exact changed workspace, not the current live website. Any non-empty diff is preserved in the review store even if Cursor or a later verification step fails.

## Execution order

1. Clone the target repository into a temporary workspace.
2. Run Cursor Agent without committing, pushing, merging, deploying, or changing DNS/MX.
3. Capture the working-tree diff.
4. Run Cursor Agent and workspace commands with an allowlisted environment. The website workspace must not inherit Hermes, Firecrawl, JEV, TypeSafe, or other service secrets. Only the Cursor API credential required by the agent is passed to Cursor.
5. Install dependencies in the isolated workspace.
6. Run the target repository's `npm run build`.
7. Start its local preview server and wait for a successful HTTP response.
8. Run the validation pipeline against the preview URL while the preview is alive.
9. Stop the preview process and remove the temporary workspace unless explicitly retained for debugging.

## Gate behavior

- Dependency installation, build, or preview startup failure marks Cursor execution as failed.
- Visual and browser validation results are reported separately; a successful build does not mean the proposal is approved.
- Human approval remains mandatory before any proposal is applied to the production website.
- The pipeline must not substitute the live URL when an isolated preview is unavailable.
- JEV is still considered not ready until the local Python agent, loopback Chromium/CDP connection, required TypeSafe/text-model credentials, and offline browser fixture are verified together in CI.
- No DNS/MX changes and no production deployment are allowed in this phase.

## Current limitations

- The local preview is accessible from the Railway worker only. A separately hosted JEV browser may not be able to reach `127.0.0.1`; JEV needs a safe preview-access strategy before it can validate interactions.
- Review records and full diffs are persisted in PostgreSQL when `DATABASE_URL` is configured. The Railway service still needs its database reference configured before durable review is active.
- Inspect and decide a stored record with `npm run review:record -- show <review-id>` or `npm run review:record -- decide <review-id> <approve|reject|iterate> <reviewer> <note>`. Approval is rejected unless validation passed.
- Validation must be treated as a proposal gate, not proof of production quality, until the end-to-end cycle is completed.
