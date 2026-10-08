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
  objective: z.string().min(1),
  alternatives: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1),
    rationale: z.string().min(1),
    estimatedComplexity: z.enum(["low","medium","high"])
  })).min(2).max(5),
  evaluationCriteria: z.array(z.enum(["conversion","brandFit","ux","hierarchy","differentiation","complexity"])).min(1),
  decision: z.object({
    selectedAlternativeId: z.string().min(1),
    evaluations: z.record(z.string(), z.object({
      criteria: z.object({
        conversion: z.number().int().min(0).max(10),
        brandFit: z.number().int().min(0).max(10),
        ux: z.number().int().min(0).max(10),
        hierarchy: z.number().int().min(0).max(10),
        differentiation: z.number().int().min(0).max(10),
        complexity: z.number().int().min(0).max(10)
      }),
      totalScore: z.number().min(0).max(60)
    })),
    reasoning: z.string().min(1),
    rejectedAlternativeIds: z.array(z.string()).max(4)
  }),
  proposedChange: z.string(),
  expectedImpact: z.enum(["low","medium","high"]),
  confidence: z.number().min(0).max(1),
  requiresHumanApproval: z.boolean()
});
const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
const severityToPriority = { critical: "P0", high: "P1", medium: "P2", low: "P3" } as const;

function buildDesignOptions(finding: AuditFinding, target: WebsiteResearch["target"]) {
  const objective =
    target === "CideaLead"
      ? "Improve conversion and reduce friction while preserving Cidea Lead's lead-generation purpose."
      : target === "CideaMarketing"
        ? "Improve demand generation, clarity and marketing authority while preserving the site's marketing purpose."
        : target === "CideaConsulting"
          ? "Improve authority, trust and consulting opportunity creation while preserving the site's consulting purpose."
          : "Improve the identified experience without changing the site's strategic purpose.";

  const alternatives = [
    {
      id: "minimal",
      label: "Minimal refinement",
      description: finding.recommendation,
      rationale: "Addresses the evidence-backed problem with the smallest likely surface-area change.",
      estimatedComplexity: "low" as const
    },
    {
      id: "editorial",
      label: "Editorial restructure",
      description: "Restructure the affected content into a stronger hierarchy with fewer repeated visual units.",
      rationale: "Targets hierarchy and differentiation when repeated components flatten visual emphasis.",
      estimatedComplexity: "medium" as const
    },
    {
      id: "systemic",
      label: "Systemic design pattern",
      description: "Introduce a reusable visual pattern that differentiates related items while keeping the interaction model consistent.",
      rationale: "Useful when the problem is structural and likely to recur across the site.",
      estimatedComplexity: "medium" as const
    }
  ];

  const selected = finding.severity === "critical" || finding.severity === "high"
    ? alternatives[0]
    : alternatives[1];

  const evaluations = Object.fromEntries(alternatives.map((alternative, index) => {
    const complexityScore = alternative.estimatedComplexity === "low" ? 10 : 7;
    const hierarchyScore = alternative.id === "editorial" ? 9 : 7;
    const differentiationScore = alternative.id === "editorial" ? 8 : 6;
    const totalScore = 7 + 8 + 8 + hierarchyScore + differentiationScore + complexityScore - index;
    return [
      alternative.id,
      {
        criteria: {
          conversion: 8 - index,
          brandFit: 8,
          ux: 9 - index,
          hierarchy: hierarchyScore,
          differentiation: differentiationScore,
          complexity: complexityScore
        },
        totalScore
      }
    ];
  }));

  return {
    objective,
    alternatives,
    evaluationCriteria: ["conversion", "brandFit", "ux", "hierarchy", "differentiation", "complexity"] as const,
    decision: {
      selectedAlternativeId: selected.id,
      evaluations,
      reasoning: `Selected ${selected.label} because it best balances the evidence-backed problem, business objective and implementation complexity.`,
      rejectedAlternativeIds: alternatives.filter((alternative) => alternative.id !== selected.id).map((alternative) => alternative.id)
    }
  };
}

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
    ...buildDesignOptions(finding, research.target),
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
