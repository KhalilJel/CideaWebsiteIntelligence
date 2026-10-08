import test from "node:test";
import assert from "node:assert/strict";
import { createHumanReviewRequest, resolveHumanReview } from "../src/domain/human-review.js";
import type { CodingTask } from "../src/domain/coding-task.js";

const task: CodingTask = {
  id: "coding-finding-1-design",
  target: "CideaLead",
  websiteUrl: "https://cidealeads.com/",
  sourceActionId: "finding-1-design",
  priority: "P1",
  category: "DESIGN",
  problem: "Cards are repetitive.",
  evidence: ["https://cidealeads.com/"],
  objective: "Improve hierarchy.",
  selectedAlternativeId: "asymmetric",
  selectedAlternativeLabel: "Asymmetric composition",
  decisionReasoning: "Best balance of differentiation and UX.",
  proposedChange: "Break equal card geometry.",
  expectedOutcome: "Improve hierarchy.",
  acceptanceCriteria: ["Implement the selected design direction."],
  verification: ["npm test"],
  nonGoals: ["No production deployment."],
  requiresHumanApproval: true
};

test("human review requires an explicit decision", () => {
  const request = createHumanReviewRequest(task, "passed");
  const result = resolveHumanReview(request, {
    action: "approve",
    reviewer: "human-reviewer",
    note: "Validation is green and the change meets the acceptance criteria.",
    reviewedAt: new Date().toISOString()
  });

  assert.equal(request.status, "review_required");
  assert.equal(result.nextStatus, "approved");
});

test("approval is blocked when validation has not passed", () => {
  const request = createHumanReviewRequest(task, "failed");

  assert.throws(
    () => resolveHumanReview(request, {
      action: "approve",
      reviewer: "human-reviewer",
      note: "Approve despite failed validation.",
      reviewedAt: new Date().toISOString()
    }),
    /passed validation pipeline/
  );
});

test("iteration requires actionable feedback", () => {
  const request = createHumanReviewRequest(task, "passed");

  assert.throws(
    () => resolveHumanReview(request, {
      action: "iterate",
      reviewer: "human-reviewer",
      note: "fix it",
      reviewedAt: new Date().toISOString()
    }),
    /Iteration feedback/
  );

  const result = resolveHumanReview(request, {
    action: "iterate",
    reviewer: "human-reviewer",
    note: "Reduce the visual contrast and keep the existing CTA hierarchy.",
    reviewedAt: new Date().toISOString()
  });

  assert.equal(result.nextStatus, "iteration_required");
});
