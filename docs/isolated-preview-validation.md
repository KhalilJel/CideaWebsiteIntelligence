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
- CI verifies the local Python agent, loopback Chromium/CDP connection, and offline browser fixture together. This does not prove Railway runtime compatibility or successful live credential configuration.
- No DNS/MX changes and no production website code changes are allowed by the validation agent.

## CI verification (2026-10-09)

- Green run: [PR workflow run](https://github.com/KhalilJel/CideaWebsiteIntelligence/actions/runs/37919078730).
- Confirmed passing steps: install dependencies, whitespace check, install Python 3.12/JEV runtime, install Chromium, real JEV browser fixture (including off-origin HTTP/WebSocket blocking), fixture/runner syntax checks, TypeScript typecheck, build, and complete test suite.
- The CI workflow initially failed before job creation because the job-level environment referenced `runner.temp`; replacing it with `/tmp/jev-ultrafast` allowed the workflow to start and pass.

## Railway runtime findings (2026-10-09)

- PR #26 was merged as `cf4a1d1a62d79eed49f4ad38428ffe97d9463b93` and Railway deployment `3e73333b-6167-42c2-a8fe-34a79ec8081c` completed successfully.
- The audit successfully ran Cursor and passed install, build, and isolated preview checks at `http://127.0.0.1:4173`.
- Browser validation did not run because the CLI supplied no browser actions; JEV reported `not_ready`, so TypeSafe was also `not_ready`. A follow-up fix supplies a minimal read-only navigation action by default.
- Durable review persistence is not active: the audit reports `DATABASE_URL is not configured`. Do not enable the staged database reference without separate approval.
- PixelJury reported two high-severity visual findings on the isolated preview; these need review and another validation cycle.
- These findings are from the isolated-preview deployment and do not prove the proposal was deployed to the production website.

## Current limitations

- JEV runs locally in the same worker as the preview and connects to an isolated Chromium instance through loopback CDP. The offline fixture is CI-verified; live Railway browser validation must pass before calling the workflow end-to-end complete.
- Review records and full diffs are persisted in PostgreSQL only when `DATABASE_URL` is configured. Until then, the workflow cannot provide durable human review.
- Inspect and decide a stored record with `npm run review:record -- show <review-id>` or `npm run review:record -- decide <review-id> <approve|reject|iterate> <reviewer> <note>`. Approval is rejected unless validation passed.
- Validation is a proposal gate, not proof of production quality, until the end-to-end cycle is completed.
