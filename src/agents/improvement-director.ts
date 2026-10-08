import { z } from "zod";
import type { WebsiteResearch } from "../domain/website-research.js";
import { prioritiesForTarget, type AuditFinding } from "../domain/website-audit.js";
import { improvementPlanSchema, type ImprovementPlan, type DesignAlternative } from "../domain/improvement-plan.js";

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

function buildDesignOptions(
  finding: AuditFinding,
  target: WebsiteResearch["target"],
  proposal?: { objective: string; alternatives: DesignAlternative[] }
) {
  const objective =
    target === "CideaLead"
      ? "Improve conversion and reduce friction while preserving Cidea Lead's lead-generation purpose."
      : target === "CideaMarketing"
        ? "Improve demand generation, clarity and marketing authority while preserving the site's marketing purpose."
        : target === "CideaConsulting"
          ? "Improve authority, trust and consulting opportunity creation while preserving the site's consulting purpose."
          : "Improve the identified experience without changing the site's strategic purpose.";

  const alternatives = proposal?.alternatives?.length
    ? proposal.alternatives
    : [
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
