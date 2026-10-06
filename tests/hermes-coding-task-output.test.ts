import test from "node:test";
import assert from "node:assert/strict";
import { improvementPlanToCodingTasks } from "../src/agents/coding-task-generator.js";
import type { ImprovementPlan } from "../src/domain/improvement-plan.js";

test("only emits selected top five actions", () => {
  const plan: ImprovementPlan = {
    target: "CideaLead",
    websiteUrl: "https://cidealeads.com/",
    generatedAt: new Date().toISOString(),
    actions: [{
      id: "finding-1-design",
      category: "DESIGN",
      priority: "P1",
      problem: "Body text is too small.",
      evidence: ["https://cidealeads.com/"],
      proposedChange: "Increase body text.",
      expectedImpact: "high",
      confidence: 0.9,
      requiresHumanApproval: true
    }],
    selectedTopFive: ["finding-1-design"],
    status: "review_required"
  };

  const tasks = improvementPlanToCodingTasks(plan);

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]?.sourceActionId, "finding-1-design");
  assert.equal(tasks[0]?.requiresHumanApproval, true);
});