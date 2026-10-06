import type { WebsiteResearch } from "../domain/website-research.js";
import type { AuditFinding } from "../domain/website-audit.js";
import type { HermesLLMClient } from "../integrations/hermes-llm.js";

export type HermesDecision = {
  summary: string;
  priorities: Array<{ category: AuditFinding["category"]; reason: string; evidenceUrls: string[] }>;
  unresolvedQuestions: string[];
  mode: "llm" | "evidence_only";
};

const system = [
  "You are Hermes, the top-level website intelligence orchestrator for Cidea.",
  "Use only supplied evidence. Never invent facts, competitors, metrics or observations.",
  "Return concise JSON with keys summary, priorities, unresolvedQuestions.",
  "priorities must contain category, reason and evidenceUrls.",
  "If evidence is insufficient, put the question in unresolvedQuestions instead of guessing."
].join(" ");

function evidenceOnly(research: WebsiteResearch, findings: AuditFinding[]): HermesDecision {
  const priorities = findings
    .slice()
    .sort((a,b) => ({critical:0,high:1,medium:2,low:3}[a.severity]-{critical:0,high:1,medium:2,low:3}[b.severity]) || b.confidence-a.confidence)
    .slice(0, 5)
    .map(f => ({ category:f.category, reason:f.title, evidenceUrls:f.evidence.map(e=>e.sourceUrl) }));
  return { summary: findings.length ? `Found ${findings.length} evidence-backed improvement opportunities.` : "No deterministic issues were found; deeper research is still required before making broad claims.", priorities, unresolvedQuestions: research.unresolvedQuestions, mode:"evidence_only" };
}

export async function reasonWithHermes(research: WebsiteResearch, findings: AuditFinding[], client?: HermesLLMClient): Promise<HermesDecision> {
  if (!client) return evidenceOnly(research, findings);
  const user = JSON.stringify({ research, findings });
  try {
    const raw = await client.complete({system, user});
    const parsed = JSON.parse(raw) as Partial<HermesDecision>;
    if (!parsed.summary || !Array.isArray(parsed.priorities) || !Array.isArray(parsed.unresolvedQuestions)) throw new Error("Invalid Hermes JSON");
    const priorities = parsed.priorities.filter(p => p && typeof p === "object" && typeof p.category === "string" && typeof p.reason === "string" && Array.isArray(p.evidenceUrls)) as HermesDecision["priorities"];
    return {summary:parsed.summary, priorities, unresolvedQuestions:parsed.unresolvedQuestions.filter(x=>typeof x==="string"), mode:"llm"};
  } catch { return evidenceOnly(research, findings); }
}
