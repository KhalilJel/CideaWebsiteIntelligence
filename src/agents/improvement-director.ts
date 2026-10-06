import { z } from "zod";
import type { WebsiteResearch } from "../domain/website-research.js";
import { prioritiesForTarget, type AuditFinding } from "../domain/website-audit.js";
import { improvementPlanSchema, type ImprovementPlan } from "../domain/improvement-plan.js";

const action = z.object({
  id: z.string(),
  category: z.enum(["UX","SEO","CRO","DESIGN","CONTENT","PERFORMANCE","TRUST"]),
  priority: z.enum(["P0","P1","P2","P3"]),
  problem: z.string(),
  evidence: z.array(z.string().url()).min(1),
  proposedChange: z.string(),
  expectedImpact: z.enum(["low","medium","high"]),
  confidence: z.number().min(0).max(1),
  requiresHumanApproval: z.boolean()
});
const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
const severityToPriority = { critical: "P0", high: "P1", medium: "P2", low: "P3" } as const;

export function findingsToImprovementCandidates(
  research: WebsiteResearch,
  findings: AuditFinding[]
): z.infer<typeof action>[] {
  const targetOrder = prioritiesForTarget(research.target);
  return findings.slice().sort((a, b) => {
    const categoryA = targetOrder.indexOf(a.category);
    const categoryB = targetOrder.indexOf(b.category);
    return (categoryA < 0 ? 99 : categoryA) - (categoryB < 0 ? 99 : categoryB)
      || severityRank[a.severity] - severityRank[b.severity]
      || b.confidence - a.confidence;
  }).map((finding, index) => ({
    id: `finding-${index + 1}-${finding.category.toLowerCase()}`,
    category: finding.category,
    priority: severityToPriority[finding.severity],
    problem: finding.observation,
    evidence: finding.evidence.map(e => e.sourceUrl),
    proposedChange: finding.recommendation,
    expectedImpact: finding.severity === "critical" || finding.severity === "high" ? "high"
      : finding.severity === "medium" ? "medium" : "low",
    confidence: finding.confidence,
    requiresHumanApproval: true
  }));
}

export function createImprovementPlan(
  research: WebsiteResearch,
  candidates: unknown[]
): ImprovementPlan {
  const valid = candidates
    .map(candidate => action.safeParse(candidate))
    .filter((result): result is { success: true; data: z.infer<typeof action> } => result.success)
    .map(result => result.data)
    .slice(0, 20);

  valid.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.confidence - a.confidence);

  return improvementPlanSchema.parse({
    target: research.target,
    websiteUrl: research.websiteUrl,
    generatedAt: new Date().toISOString(),
    actions: valid,
    selectedTopFive: valid.slice(0, 5).map(item => item.id),
    status: "review_required"
  });
}
