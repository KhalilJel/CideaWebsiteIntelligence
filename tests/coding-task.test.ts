import { describe, expect, it } from "vitest";
import { improvementActionToCodingTask } from "../src/domain/coding-task.js";

describe("coding task generation", () => {
  it("turns an improvement action into a guarded coding task", () => {
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

    expect(task.id).toBe("coding-finding-1-design");
    expect(task.requiresHumanApproval).toBe(true);
    expect(task.nonGoals).toContain("No DNS or MX changes.");
    expect(task.acceptanceCriteria.length).toBeGreaterThan(0);
  });
});
