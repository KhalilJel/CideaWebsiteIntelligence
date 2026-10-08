import test from "node:test";
import assert from "node:assert/strict";
import { improvementActionToCodingTask } from "../src/domain/coding-task.js";

test("turns an improvement action into a guarded coding task", () => {
  const task = improvementActionToCodingTask({
    id: "finding-1-design",
    category: "DESIGN",
    priority: "P1",
    problem: "Body text is too small.",
    evidence: ["https://cidealeads.com/"],
    objective: "Improve readability without changing the site's strategic purpose.",
    alternatives: [
      { id: "minimal", label: "Minimal refinement", description: "Increase body text size.", rationale: "Smallest change.", estimatedComplexity: "low" },
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
    proposedChange: "Increase body text to a readable size.",
    expectedImpact: "high",
    requiresHumanApproval: true
  }, "CideaLead", "https://cidealeads.com/");

  assert.equal(task.id, "coding-finding-1-design");
  assert.equal(task.requiresHumanApproval, true);
  assert.equal(task.selectedAlternativeId, "minimal");
  assert.equal(task.selectedAlternativeLabel, "Minimal refinement");
  assert.equal(task.objective, "Improve readability without changing the site's strategic purpose.");
  assert.match(task.decisionReasoning, /lowest complexity/);
  assert.ok(task.nonGoals.includes("No DNS or MX changes."));
  assert.ok(task.acceptanceCriteria.length > 0);
});

test("Improvement Director emits alternatives and a coherent decision", async () => {
  const { findingsToImprovementCandidates, createImprovementPlan } = await import("../src/agents/improvement-director.js");
  const research = { target: "CideaLead", websiteUrl: "https://example.com", collectedAt: new Date().toISOString(), sources: [], signals: [], unresolvedQuestions: [] } as any;
  const candidates = findingsToImprovementCandidates(research, [{
    category: "DESIGN", severity: "medium", title: "Repeated cards", observation: "Cards look visually repetitive", recommendation: "Strengthen hierarchy",
    evidence: [{ sourceUrl: "https://example.com", observation: "Repeated cards" }], confidence: 0.9
  }]);
  const plan = createImprovementPlan(research, candidates);
  const action = plan.actions[0];
  assert.ok(action);
  assert.ok(action.alternatives.length >= 2);
  assert.ok(action.alternatives.some(alternative => alternative.id === action.decision.selectedAlternativeId));
  assert.deepEqual(new Set(action.decision.rejectedAlternativeIds).size, action.decision.rejectedAlternativeIds.length);
  assert.ok(action.decision.reasoning.length > 0);
});
