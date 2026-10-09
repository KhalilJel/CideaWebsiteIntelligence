import { createFirecrawlClient } from "../integrations/firecrawl.js";
import { createAgentReachClient, type AgentReachClient } from "../integrations/agent-reach.js";
import { createHermesLLMClient } from "../integrations/hermes-llm.js";
import type { JEVBrowserClient } from "../integrations/jev-browser.js";
import { auditCandidate } from "../integrations/website-audit.js";
import { hermesResearch } from "./hermes-research.js";
import { reasonWithHermes, imagineWithHermes, decideAllWithHermes } from "./hermes-reasoning.js";
import { createImprovementPlan, findingsToImprovementCandidates } from "./improvement-director.js";
import { runBrowserJourney } from "./browser-journey.js";
import { runDeterministicSpecialistAudits } from "./specialist-audits.js";
import type { ImprovementPlan } from "../domain/improvement-plan.js";
import type { WebsiteResearch } from "../domain/website-research.js";
import type { WebsiteTarget, AuditFinding } from "../domain/website-audit.js";
import { enrichWithExternalResearch } from "./external-research.js";
import { pixelJuryEnabled, runPixelJury } from "../integrations/pixeljury.js";
import { improvementPlanToCodingTasks } from "./coding-task-generator.js";
import { executeCodingTaskWithCursor, type CursorExecutionResult } from "./cursor-execution.js";
import type { CodingTask } from "../domain/coding-task.js";
import type { ValidationPipelineResult } from "./validation-pipeline.js";
import { validateBrowserActions } from "./typesafe-browser.js";

export type HermesPipelineInput = {
  target: WebsiteTarget;
  websiteUrl: string;
  findings?: AuditFinding[];
  candidateActions?: unknown[];
  enableFirecrawl?: boolean;
  agentReach?: AgentReachClient;
  browser?: JEVBrowserClient;
  browserActions?: unknown[];
  cursor?: {
    repositoryUrl: string;
    ref?: string;
    enabled?: boolean;
  };
};

export type HermesPipelineResult = {
  research: WebsiteResearch;
  hermes: Awaited<ReturnType<typeof reasonWithHermes>>;
  imagine: Awaited<ReturnType<typeof imagineWithHermes>>;
  decide: Awaited<ReturnType<typeof decideAllWithHermes>>;
  improvementPlan: ImprovementPlan;
  codingTasks: CodingTask[];
  baseline: Awaited<ReturnType<typeof auditCandidate>>;
  browser?: Awaited<ReturnType<typeof runBrowserJourney>>;
  pixelJury?: Awaited<ReturnType<typeof runPixelJury>>;
  cursorExecution?: CursorExecutionResult;
  validation?: ValidationPipelineResult;
};

export async function runHermesPipeline(input: HermesPipelineInput): Promise<HermesPipelineResult> {
  const baseline = await auditCandidate({
    companyName: input.target,
    websiteUrl: input.websiteUrl,
    sourceUrl: input.websiteUrl
  });
  const specialistFindings = runDeterministicSpecialistAudits(baseline);

  const firecrawl = input.enableFirecrawl === false ? undefined : createFirecrawlClient();
  const research = await hermesResearch(
    { target: input.target, websiteUrl: input.websiteUrl },
    { firecrawl }
  );

  const browser = input.browser && input.browserActions?.length
    ? await runBrowserJourney(input.browser, input.browserActions)
    : undefined;

  const browserSources = browser?.observations.map(o => ({
    url: o.url,
    sourceType: "browser" as const,
    collectedAt: o.collectedAt,
    excerpt: o.observation
  })) ?? [];

  const browserSignals = browser?.observations
    .filter(o => o.result !== "success")
    .map(o => ({
      category: "UX" as const,
      claim: "A browser journey encountered an interaction failure.",
      evidence: o.observation,
      sourceUrls: [o.url],
      confidence: o.result === "blocked" ? 0.6 : 0.9
    })) ?? [];

  const researchWithBrowserEvidence: WebsiteResearch = {
    ...research,
    sources: [
      ...research.sources,
      {
        url: baseline.finalUrl ?? input.websiteUrl,
        title: baseline.title,
        sourceType: "website",
        collectedAt: baseline.checkedAt,
        excerpt: baseline.metaDescription
      },
      ...browserSources
    ],
    signals: [...research.signals, ...browserSignals]
  };

  const agentReach = input.agentReach ?? createAgentReachClient();
  const enrichedResearch = await enrichWithExternalResearch(researchWithBrowserEvidence, agentReach);

  const pixelJury = pixelJuryEnabled() ? await runPixelJury(input.websiteUrl) : undefined;
  const pixelJurySources = pixelJury ? [{
    url: input.websiteUrl,
    sourceType: "other" as const,
    collectedAt: pixelJury.collectedAt,
    excerpt: pixelJury.critique.slice(0, 2000)
  }] : [];

  const pixelJurySignals = pixelJury ? [{
    category: "DESIGN" as const,
    claim: `PixelJury visual QA returned a score of ${pixelJury.score ?? "unknown"} for the page.`,
    evidence: pixelJury.critique.slice(0, 2000),
    sourceUrls: [input.websiteUrl],
    confidence: 0.8
  }] : [];

  const researchWithPixelJury: WebsiteResearch = {
    ...enrichedResearch,
    sources: [...enrichedResearch.sources, ...pixelJurySources],
    signals: [...enrichedResearch.signals, ...pixelJurySignals]
  };

  const findings = [
    ...specialistFindings,
    ...(input.findings ?? []),
    ...(browser?.summary.findings ?? []),
    ...(pixelJury?.findings ?? [])
  ];

  const hermesClient = createHermesLLMClient();
  const hermes = await reasonWithHermes(researchWithPixelJury, findings, hermesClient);
  const imagine = await imagineWithHermes(researchWithPixelJury, findings, hermesClient);
  const decide = await decideAllWithHermes(
    researchWithPixelJury,
    findings,
    imagine.proposals,
    hermesClient
  );

  const generatedCandidates = findingsToImprovementCandidates(
    researchWithPixelJury,
    findings,
    imagine.proposals,
    decide
  );
  const candidateActions = [...generatedCandidates, ...(input.candidateActions ?? [])];
  const improvementPlan = createImprovementPlan(researchWithPixelJury, candidateActions);
  const codingTasks = improvementPlanToCodingTasks(improvementPlan);

  const cursorExecution = input.cursor?.enabled !== false && input.cursor?.repositoryUrl && codingTasks[0]
    ? await executeCodingTaskWithCursor(codingTasks[0], {
        repositoryUrl: input.cursor.repositoryUrl,
        ref: input.cursor.ref,
        browserActions: input.browserActions ? validateBrowserActions(input.browserActions) : []
      })
    : undefined;

  const validation = cursorExecution?.validation;

  return {
    research: researchWithPixelJury,
    hermes,
    imagine,
    decide,
    improvementPlan,
    codingTasks,
    baseline,
    browser,
    pixelJury,
    cursorExecution,
    validation
  };
}
