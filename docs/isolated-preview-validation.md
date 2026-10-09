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
- CI now verifies the local Python agent, loopback Chromium/CDP connection, and offline browser fixture together. This does not yet prove Railway runtime compatibility or successful live credential configuration.
- No DNS/MX changes and no production deployment are allowed in this phase.

## CI verification (2026-10-09)

- Green run: [PR workflow run](https://github.com/KhalilJel/CideaWebsiteIntelligence/actions/runs/37918927605).
- Confirmed passing steps: install dependencies, whitespace check, install Python 3.12/JEV runtime, install Chromium, real JEV browser fixture (including off-origin HTTP/WebSocket blocking), fixture/runner syntax checks, TypeScript typecheck, build, and complete test suite.
- The CI workflow initially failed before job creation because the job-level environment referenced `runner.temp`; replacing it with `/tmp/jev-ultrafast` allowed the workflow to start and pass.
- CI validates the offline fixture, not the Railway deployment. No production deployment or DNS/MX change was made.

## Railway runtime readiness (2026-10-09)

Read-only inspection of the current production environment found these blockers for a live end-to-end test:

- The service still deploys from `runtime/cycle-3-agent-reach`; the isolated-preview/JEV adapter changes in PR #26 are not deployed.
- `TYPESAFE_API_KEY` is configured on the service, but `TEXT_MODEL_API_KEY` required by the new local JEV adapter is not present. The existing Hermes model key is not assumed compatible without verifying its provider and endpoint contract.
- `DATABASE_URL` is not live. A one-variable Railway patch referencing the existing Postgres service remains staged and unaccepted; durable review-store persistence is therefore not enabled.
- `TEXT_MODEL_BASE_URL`, `TEXT_MODEL`, and `TEXT_MODEL_REASONING` are optional in the adapter and have documented defaults; the default model/key combination still must be confirmed against the actual provider credentials.
- The current deployed audit logs show JEV and TypeSafe as not ready, plus three high-severity PixelJury findings on the live website. These are observations from the existing deployment, not a test of PR #26.

No deployment, variable acceptance, DNS/MX change, or change to another Railway service was made. The next live-runtime test must wait for an approved deployment and confirmed text-model credentials; the staged database reference must remain unaccepted until separately approved.

## Current limitations

- JEV runs locally in the same worker as the preview and connects to an isolated Chromium instance through loopback CDP. The offline fixture is CI-verified; Railway end-to-end execution remains unverified. Do not replace the private preview with a public URL or a guessed hosted `/execute` endpoint.
- Review records and full diffs are persisted in PostgreSQL when `DATABASE_URL` is configured. The Railway service still needs its database reference configured before durable review is active.
- Inspect and decide a stored record with `npm run review:record -- show <review-id>` or `npm run review:record -- decide <review-id> <approve|reject|iterate> <reviewer> <note>`. Approval is rejected unless validation passed.
- Validation must be treated as a proposal gate, not proof of production quality, until the end-to-end cycle is completed.
