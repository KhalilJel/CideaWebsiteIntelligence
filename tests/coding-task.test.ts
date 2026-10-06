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