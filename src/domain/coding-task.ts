import { z } from "zod";
import { cideaTargetSchema, auditCategorySchema } from "./website-audit.js";

export const codingTaskSchema = z.object({
  id: z.string().min(1),
  target: cideaTargetSchema,
  websiteUrl: z.string().url(),
  sourceActionId: z.string().min(1),
  priority: z.enum(["P0","P1","P2","P3"]),
  category: auditCategorySchema,
  problem: z.string().min(1),
  evidence: z.array(z.string().url()).min(1),
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
    priority: "P0"|"P1"|"P2"|"P3";
    problem: string;
    evidence: string[];
    proposedChange: string;
    expectedImpact: "low"|"medium"|"high";
    requiresHumanApproval: boolean;
  },
  target: z.infer<typeof cideaTargetSchema>,
  websiteUrl: string
): CodingTask {
  return codingTaskSchema.parse({
    id: \`coding-\${action.id}\`,
    target,
    websiteUrl,
    sourceActionId: action.id,
    priority: action.priority,
    category: action.category,
    problem: action.problem,
    evidence: action.evidence,
    proposedChange: action.proposedChange,
    expectedOutcome: \`Improve \${action.category} for \${target} while preserving the site's existing strategic purpose.\`,
    acceptanceCriteria: [
      \`The identified \${action.category} issue is addressed without introducing a new regression.\`,
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
      "Do not change the strategic positioning of the Cidea website."
    ],
    requiresHumanApproval: true
  });
}
