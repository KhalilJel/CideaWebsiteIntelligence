import { z } from "zod";
import { websiteTargetSchema, auditCategorySchema } from "./website-audit.js";

export const designAlternativeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  rationale: z.string().min(1),
  estimatedComplexity: z.enum(["low", "medium", "high"]),
});

export const decisionEvaluationSchema = z.object({
  criteria: z.object({
    conversion: z.number().int().min(0).max(10),
    brandFit: z.number().int().min(0).max(10),
    ux: z.number().int().min(0).max(10),
    hierarchy: z.number().int().min(0).max(10),
    differentiation: z.number().int().min(0).max(10),
    complexity: z.number().int().min(0).max(10),
  }),
  totalScore: z.number().min(0).max(60),
});

export const improvementActionSchema = z.object({
  id: z.string().min(1),
  category: auditCategorySchema,
  priority: z.enum(["P0","P1","P2","P3"]),
  problem: z.string().min(1),
  evidence: z.array(z.string().url()).min(1),
  objective: z.string().min(1),
  alternatives: z.array(designAlternativeSchema).min(2).max(5),
  evaluationCriteria: z.array(z.enum([
    "conversion",
    "brandFit",
    "ux",
    "hierarchy",
    "differentiation",
    "complexity"
  ])).min(1),
  decision: z.object({
    selectedAlternativeId: z.string().min(1),
    evaluations: z.record(z.string(), decisionEvaluationSchema),
    reasoning: z.string().min(1),
    rejectedAlternativeIds: z.array(z.string()).max(4),
  }),
  proposedChange: z.string().min(1),
  expectedImpact: z.enum(["low","medium","high"]),
  confidence: z.number().min(0).max(1),
  requiresHumanApproval: z.boolean()
}).superRefine((action, ctx) => {
  const ids = new Set(action.alternatives.map((alternative) => alternative.id));
  if (!ids.has(action.decision.selectedAlternativeId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["decision", "selectedAlternativeId"],
      message: "Selected alternative must exist in alternatives."
    });
  }

  for (const [alternativeId] of Object.entries(action.decision.evaluations)) {
    if (!ids.has(alternativeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision", "evaluations"],
        message: `Unknown alternative evaluation: ${alternativeId}`
      });
    }
  }
});

export const improvementPlanSchema = z.object({
  target: websiteTargetSchema,
  websiteUrl: z.string().url(),
  generatedAt: z.string().datetime(),
  actions: z.array(improvementActionSchema).max(20),
  selectedTopFive: z.array(z.string()).max(5),
  status: z.enum(["draft","review_required","approved","implemented"])
});

export type ImprovementPlan = z.infer<typeof improvementPlanSchema>;
export type ImprovementAction = z.infer<typeof improvementActionSchema>;
export type DesignAlternative = z.infer<typeof designAlternativeSchema>;
