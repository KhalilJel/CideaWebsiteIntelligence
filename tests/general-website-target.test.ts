import test from "node:test";
import assert from "node:assert/strict";
import { prioritiesForTarget } from "../src/domain/website-audit.js";
import { researchBrief } from "../src/domain/website-research.js";
import { improvementActionToCodingTask } from "../src/domain/coding-task.js";

test("supports a non-Cidea website target", () => {
  const target = "Example Restaurant";
  const priorities = prioritiesForTarget(target);

  assert.deepEqual(priorities.slice(0, 3), ["CRO", "TRUST", "UX"]);
  assert.match(researchBrief(target), /business model/i);

  const task = improvementActionToCodingTask({
    id: "finding-1-cro",
    category: "CRO",
    priority: "P1",
    problem: "The primary booking path is hard to find.",
    evidence: ["https://example.com/"],
    proposedChange: "Make the primary booking action more prominent.",
    expectedImpact: "high",
    requiresHumanApproval: true
  }, target, "https://example.com/");

  assert.equal(task.target, target);
});