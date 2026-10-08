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
      objective: "Improve readability without changing the site's strategic purpose.",
      alternatives: [
        { id: "minimal", label: "Minimal refinement", description: "Increase body text.", rationale: "Smallest change.", estimatedComplexity: "low" },
        { id: "editorial", label: "Editorial refinement", description: "Improve typography hierarchy.", rationale: "Strengthens readability and hierarchy.", estimatedComplexity: "medium" }
      ],
      evaluationCriteria: ["ux", "hierarchy", "complexity"],
      decision: {
        selectedAlternativeId: "minimal",
        evaluations: {
          minimal: { criteria: { conversion: 7, brandFit: 8, ux: 9, hierarchy: 8, differentiation: 6, complexity: 10 }, totalScore: 48 },
          editorial: { criteria: { conversion: 7, brandFit: 8, ux: 8, hierarchy: 9, differentiation: 7, complexity: 7 }, totalScore: 46 }
        },
        reasoning: "Minimal refinement solves the readability issue with the lowest complexity.",
        rejectedAlternativeIds: ["editorial"]
      },
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