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

console.log(JSON.stringify(result, null, 2));
