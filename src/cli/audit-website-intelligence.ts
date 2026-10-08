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

const result = await runHermesPipeline({
  target,
  websiteUrl: url,
  cursor: cursorRepositoryUrl
    ? { repositoryUrl: cursorRepositoryUrl, enabled: cursorEnabled }
    : undefined
});

const cursor = result.cursorExecution;
const validation = result.validation;

console.log(JSON.stringify({
  target,
  websiteUrl: url,
  baselineScore: result.baseline.score,
  findings: result.improvementPlan.actions.length,
  selectedAlternatives: result.improvementPlan.actions.map(action => action.decision.selectedAlternativeId),
  cursor: cursor
    ? {
        status: cursor.status,
        repositoryUrl: cursor.repositoryUrl,
        exitCode: cursor.cursor?.exitCode ?? null,
        diffBytes: cursor.diff?.length ?? 0,
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
          summary: check.summary
        }))
      }
    : {
        status: "not_run"
      }
}, null, 2));
