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

console.log(JSON.stringify({
  target,
  websiteUrl: url,
  baselineScore: result.baseline.score,
  findings: result.improvementPlan.actions.length,
  selectedAlternatives: result.improvementPlan.actions.map(action => action.decision.selectedAlternativeId),
  cursor: result.cursorExecution
    ? {
        status: result.cursorExecution.status,
        repositoryUrl: result.cursorExecution.repositoryUrl,
        exitCode: result.cursorExecution.cursor?.exitCode ?? null,
        diffBytes: result.cursorExecution.diff?.length ?? 0,
        error: result.cursorExecution.error ?? null
      }
    : {
        status: "not_run",
        enabled: cursorEnabled,
        repositoryUrl: cursorRepositoryUrl ?? null
      }
}, null, 2));
