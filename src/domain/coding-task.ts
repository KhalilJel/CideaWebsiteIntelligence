import { z } from "zod";
import { websiteTargetSchema, auditCategorySchema } from "./website-audit.js";
import type { ImprovementAction } from "./improvement-plan.js";

export const codingTaskSchema = z.object({
  id: z.string().min(1),
  target: websiteTargetSchema,
  websiteUrl: z.string().url(),
  sourceActionId: z.string().min(1),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  category: auditCategorySchema,
  problem: z.string().min(1),
  evidence: z.array(z.string().url()).min(1),
  objective: z.string().min(1),
  selectedAlternativeId: z.string().min(1),
  selectedAlternativeLabel: z.string().min(1),
  decisionReasoning: z.string().min(1),
  proposedChange: z.string().min(1),
  expectedOutcome: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1).max(10),
  verification: z.array(z.string().min(1)).min(1).max(10),
  nonGoals: z.array(z.string().min(1)).min(1).max(10),
  requiresHumanApproval: z.literal(true)
});

export type CodingTask = z.infer<typeof codingTaskSchema>;

export function improvementActionToCodingTask(
  action: {
    id: string;
    category: z.infer<typeof auditCategorySchema>;
    priority: "P0" | "P1" | "P2" | "P3";
    problem: string;
    evidence: string[];
    proposedChange: string;
    expectedImpact: "low" | "medium" | "high";
    requiresHumanApproval: boolean;
  } & Partial<Pick<ImprovementAction, "objective" | "alternatives" | "evaluationCriteria" | "decision">> & Record<string, unknown>,
  target: z.infer<typeof websiteTargetSchema>,
  websiteUrl: string
): CodingTask {
  return codingTaskSchema.parse({
    id: `coding-${action.id}`,
    target,
    websiteUrl,
    sourceActionId: action.id,
    priority: action.priority,
    category: action.category,
    problem: action.problem,
    evidence: action.evidence,
    objective: action.objective ?? `Improve ${action.category} for ${target} while preserving the site's existing strategic purpose.`,
    selectedAlternativeId: action.decision?.selectedAlternativeId ?? "not-specified",
    selectedAlternativeLabel: action.alternatives?.find(alternative => alternative.id === action.decision?.selectedAlternativeId)?.label ?? "Selected design direction",
    decisionReasoning: action.decision?.reasoning ?? "Deterministic fallback decision was used because no validated Hermes decision was available.",
    proposedChange: action.decision?.selectedAlternativeId
      ? `${action.alternatives?.find(alternative => alternative.id === action.decision?.selectedAlternativeId)?.description ?? action.proposedChange}`
      : action.proposedChange,
    expectedOutcome: `${action.objective ?? `Improve ${action.category} for ${target} while preserving the site's existing strategic purpose.`}`,
    acceptanceCriteria: [
      `Implement the selected design direction: ${action.decision?.selectedAlternativeId ? action.alternatives?.find(alternative => alternative.id === action.decision?.selectedAlternativeId)?.label ?? "selected alternative" : "proposed change"}.`,
      `The task advances this objective: ${action.objective ?? `Improve ${action.category} for ${target}.`}`,
      `The identified ${action.category} issue is addressed without introducing a new regression.`,
      "Existing content, navigation and conversion paths remain functional.",
      "Typecheck and tests pass.",
      "PixelJury visual audit is rerun when the change affects UI or styling."
    ],
    verification: [
      "npm run typecheck",
      "npm test",
      "npm run audit:visual -- <website-url> when UI/styling changed"
    ],
    nonGoals: [
      "No production deployment.",
      "No DNS or MX changes.",
      "Do not redesign unrelated sections.",
      "Do not change the strategic positioning of the website."
    ],
    requiresHumanApproval: true
  });
}