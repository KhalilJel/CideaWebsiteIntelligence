import { createFirecrawlClient } from "../integrations/firecrawl.js";
import { createAgentReachClient, type AgentReachClient } from "../integrations/agent-reach.js";
import { createHermesLLMClient } from "../integrations/hermes-llm.js";
import type { JEVBrowserClient } from "../integrations/jev-browser.js";
import { hermesResearch } from "./hermes-research.js";
import { reasonWithHermes } from "./hermes-reasoning.js";
import { createImprovementPlan, findingsToImprovementCandidates } from "./improvement-director.js";
import { runBrowserJourney } from "./browser-journey.js";
import type { ImprovementPlan } from "../domain/improvement-plan.js";
import type { WebsiteResearch } from "../domain/website-research.js";
import type { CideaTarget, AuditFinding } from "../domain/website-audit.js";
import { enrichWithExternalResearch } from "./external-research.js";

export type HermesPipelineInput={target:CideaTarget;websiteUrl:string;findings?:AuditFinding[];candidateActions?:unknown[];enableFirecrawl?:boolean;agentReach?:AgentReachClient;browser?:JEVBrowserClient;browserActions?:unknown[]};
export type HermesPipelineResult={research:WebsiteResearch;hermes:Awaited<ReturnType<typeof reasonWithHermes>>;improvementPlan:ImprovementPlan;browser?:Awaited<ReturnType<typeof runBrowserJourney>>};

export async function runHermesPipeline(input:HermesPipelineInput):Promise<HermesPipelineResult>{
  const firecrawl=input.enableFirecrawl===false?undefined:createFirecrawlClient();
  const research=await hermesResearch({target:input.target,websiteUrl:input.websiteUrl},{firecrawl});
  const browser=input.browser&&input.browserActions?.length?await runBrowserJourney(input.browser,input.browserActions):undefined;
  const browserSources=browser?.observations.map(o=>({url:o.url,sourceType:"browser" as const,collectedAt:o.collectedAt,excerpt:o.observation}))??[];
  const browserSignals=browser?.observations.filter(o=>o.result!=="success").map(o=>({category:"UX" as const,claim:"A browser journey encountered an interaction failure.",evidence:o.observation,sourceUrls:[o.url],confidence:o.result==="blocked"?.6:.9}))??[];
  const researchWithBrowserEvidence:WebsiteResearch={...research,sources:[...research.sources,...browserSources],signals:[...research.signals,...browserSignals]};
  const agentReach=input.agentReach??createAgentReachClient();
  const enrichedResearch=await enrichWithExternalResearch(researchWithBrowserEvidence,agentReach);
  const findings=[...(input.findings??[]),...(browser?.summary.findings??[])];
  const hermes=await reasonWithHermes(enrichedResearch,findings,createHermesLLMClient());
  const generatedCandidates=findingsToImprovementCandidates(enrichedResearch,findings);
  const candidateActions=[...generatedCandidates,...(input.candidateActions??[])];
  const improvementPlan=createImprovementPlan(enrichedResearch,candidateActions);
  return{research:enrichedResearch,hermes,improvementPlan,browser};
}
