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
    proposedChange: "Increase body text to a readable size.",
    expectedImpact: "high",
    requiresHumanApproval: true
  }, "CideaLead", "https://cidealeads.com/");

  assert.equal(task.id, "coding-finding-1-design");
  assert.equal(task.requiresHumanApproval, true);
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
