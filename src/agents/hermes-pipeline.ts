import { createFirecrawlClient } from "../integrations/firecrawl.js";
import { createHermesLLMClient } from "../integrations/hermes-llm.js";
import type { JEVBrowserClient } from "../integrations/jev-browser.js";
import { hermesResearch } from "./hermes-research.js";
import { reasonWithHermes } from "./hermes-reasoning.js";
import { createImprovementPlan } from "./improvement-director.js";
import { runBrowserJourney } from "./browser-journey.js";
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
  browser?: JEVBrowserClient;
  browserActions?: unknown[];
};

export type HermesPipelineResult = {
  research: WebsiteResearch;
  hermes: Awaited<ReturnType<typeof reasonWithHermes>>;
  improvementPlan: ImprovementPlan;
  browser?: Awaited<ReturnType<typeof runBrowserJourney>>;
};

export async function runHermesPipeline(input: HermesPipelineInput): Promise<HermesPipelineResult> {
  const firecrawl = input.enableFirecrawl === false ? undefined : createFirecrawlClient();
  const research = await hermesResearch(
    { target: input.target, websiteUrl: input.websiteUrl },
    { firecrawl }
  );

  const browser =
    input.browser && input.browserActions?.length
      ? await runBrowserJourney(input.browser, input.browserActions)
      : undefined;

  const browserSources = browser?.observations.map(observation => ({
    url: observation.url,
    sourceType: "browser" as const,
    collectedAt: observation.collectedAt,
    excerpt: observation.observation
  })) ?? [];

  const browserSignals = browser?.observations
    .filter(observation => observation.result !== "success")
    .map(observation => ({
      category: "UX" as const,
      claim: "A browser journey encountered an interaction failure.",
      evidence: observation.observation,
      sourceUrls: [observation.url],
      confidence: observation.result === "blocked" ? 0.6 : 0.9
    })) ?? [];

  const researchWithBrowserEvidence: WebsiteResearch = {
    ...research,
    sources: [...research.sources, ...browserSources],
    signals: [...research.signals, ...browserSignals]
  };

  const enrichedResearch = await enrichWithExternalResearch(
    researchWithBrowserEvidence,
    input.agentReach
  );

  const findings = [
    ...(input.findings ?? []),
    ...(browser?.summary.findings ?? [])
  ];

  const hermes = await reasonWithHermes(
    enrichedResearch,
    findings,
    createHermesLLMClient()
  );
  const improvementPlan = createImprovementPlan(
    enrichedResearch,
    input.candidateActions ?? []
  );
  return { research: enrichedResearch, hermes, improvementPlan, browser };
}
