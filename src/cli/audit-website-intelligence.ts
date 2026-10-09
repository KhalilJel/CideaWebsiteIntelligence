import { runHermesPipeline } from "../agents/hermes-pipeline.js";
import { websiteTargetSchema } from "../domain/website-audit.js";

const url = process.argv[2];
if (!url) {
  throw new Error("Usage: npm run audit:website:intelligence -- https://example.com [target]");
}

const target = websiteTargetSchema.parse(
  process.argv[3] ?? new URL(url).hostname.replace(/^www\./, "")
);

const cursorRepositoryUrl = process.argv[4] ?? process.env.CURSOR_TARGET_REPO;
const cursorEnabled =
  process.env.CURSOR_AGENT_ENABLED === "true" && Boolean(cursorRepositoryUrl);

// Always provide a minimal read-only navigation action for isolated-preview QA.
// JEV uses this non-empty list as its validation gate and navigates to the preview URL.
const browserActions = [{ type: "navigate" as const, target: url }];

const result = await runHermesPipeline({
  target,
  websiteUrl: url,
  browserActions,
  cursor: cursorRepositoryUrl
    ? { repositoryUrl: cursorRepositoryUrl, enabled: cursorEnabled }
    : undefined
});

const cursor = result.cursorExecution;
const validation = result.validation;

console.log(JSON.stringify({
  target,
  websiteUrl: url,
  baseline: { status: result.baseline.status, flags: result.baseline.flags },
  findings: result.improvementPlan.actions.length,
  selectedAlternatives: result.improvementPlan.actions.map(action => action.decision.selectedAlternativeId),
  cursor: cursor
    ? {
        status: cursor.status,
        repositoryUrl: cursor.repositoryUrl,
        exitCode: cursor.cursor?.exitCode ?? null,
        diffBytes: cursor.diff?.length ?? 0,
        reviewPersistence: cursor.reviewPersistence ?? null,
        verification: cursor.verification ? {
          installStatus: cursor.verification.installStatus,
          buildStatus: cursor.verification.buildStatus,
          previewStatus: cursor.verification.previewStatus,
          previewUrl: cursor.verification.previewUrl ?? null,
          error: cursor.verification.error ?? null,
          pixelJuryScore: cursor.verification.pixelJury?.score ?? null
        } : null,
        error: cursor.error ?? null,
        stderr: cursor.cursor?.stderr?.slice(-3000) ?? null,
        stdout: cursor.cursor?.stdout?.slice(-3000) ?? null
      }
    : {
        status: "not_run",
        enabled: cursorEnabled,
        repositoryUrl: cursorRepositoryUrl ?? null
      },
  validation: validation
    ? {
        status: validation.status,
        checks: validation.checks.map(check => ({
          name: check.name,
          status: check.status,
          summary: check.summary,
          details: check.details ?? null
        }))
      }
    : {
        status: "not_run"
      }
}, null, 2));
