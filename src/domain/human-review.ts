import { z } from "zod";
import { codingTaskSchema, type CodingTask } from "./coding-task.js";

export const humanReviewDecisionSchema = z.object({
  action: z.enum(["approve", "reject", "iterate"]),
  reviewer: z.string().min(1),
  note: z.string().min(1),
  reviewedAt: z.string().datetime()
}).superRefine((review, ctx) => {
  if (review.action === "iterate" && review.note.trim().length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["note"],
      message: "Iteration feedback must explain what should change."
    });
  }
});

export type HumanReviewDecision = z.infer<typeof humanReviewDecisionSchema>;

export type HumanReviewRequest = {
  task: CodingTask;
  validationStatus: "passed" | "failed" | "not_ready";
  status: "review_required";
};

export const humanReviewRequestSchema = z.object({
  task: codingTaskSchema,
  validationStatus: z.enum(["passed", "failed", "not_ready"]),
  status: z.literal("review_required")
});

export function createHumanReviewRequest(
  task: CodingTask,
  validationStatus: HumanReviewRequest["validationStatus"]
): HumanReviewRequest {
  return humanReviewRequestSchema.parse({
    task,
    validationStatus,
    status: "review_required"
  });
}

export function resolveHumanReview(
  request: HumanReviewRequest,
  decision: HumanReviewDecision
): {
  decision: HumanReviewDecision;
  nextStatus: "approved" | "rejected" | "iteration_required";
} {
  const parsed = humanReviewDecisionSchema.parse(decision);

  if (parsed.action === "approve" && request.validationStatus !== "passed") {
    throw new Error("Production approval requires a passed validation pipeline.");
  }

  return {
    decision: parsed,
    nextStatus:
      parsed.action === "approve"
        ? "approved"
        : parsed.action === "reject"
          ? "rejected"
          : "iteration_required"
  };
}
