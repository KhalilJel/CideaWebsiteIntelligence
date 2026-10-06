import { createFirecrawlClient } from "../integrations/firecrawl.js";
import { createHermesLLMClient } from "../integrations/hermes-llm.js";
import { hermesResearch } from "./hermes-research.js";
import { reasonWithHermes } from "./hermes-reasoning.js";
import { createImprovementPlan } from "./improvement-director.js";
import type { ImprovementPlan } from "../domain/improvement-plan.js";
import type { WebsiteResearch } from "../domain/website-research.js";
import type { CideaTarget, AuditFinding } from "../domain/website-audit.js";
import type { AgentReachClient } from "../integrations/agent-reach.js";
import { enrichWithExternalResearch } from "./external-research.js";

export type HermesPipelineInput = {
  target: CideaTarget;
  websiteUrl: string;
  findings?: AuditFinding[];
  candidateActions?: unknown[];
  enableFirecrawl?: boolean;
  agentReach?: AgentReachClient;
};

export type HermesPipelineResult = {
  research: WebsiteResearch;
  hermes: Awaited<ReturnType<typeof reasonWithHermes>>;
  improvementPlan: ImprovementPlan;
};

export async function runHermesPipeline(input: HermesPipelineInput): Promise<HermesPipelineResult> {
  const firecrawl = input.enableFirecrawl === false ? undefined : createFirecrawlClient();
  const research = await hermesResearch(
    { target: input.target, websiteUrl: input.websiteUrl },
    { firecrawl }
  );
  const enrichedResearch = await enrichWithExternalResearch(research, input.agentReach);
  const hermes = await reasonWithHermes(
    enrichedResearch,
    input.findings ?? [],
    createHermesLLMClient()
  );
  const improvementPlan = createImprovementPlan(
    enrichedResearch,
    input.candidateActions ?? []
  );
  return { research: enrichedResearch, hermes, improvementPlan };
}
