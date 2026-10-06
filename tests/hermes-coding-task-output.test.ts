import { describe, expect, it } from "vitest";
import { improvementPlanToCodingTasks } from "../src/agents/coding-task-generator.js";

describe("ImprovementPlan to CodingTask handoff", () => {
  it("only emits selected top five actions", () => {
    const plan = {
      target: "CideaLead",
      websiteUrl: "https://cidealeads.com/",
      generatedAt: new Date().toISOString(),
      actions: [{
        id: "finding-1-design", category: "DESIGN", priority: "P1",
        problem: "Body text is too small.", evidence: ["https://cidealeads.com/"],
        proposedChange: "Increase body text.", expectedImpact: "high",
        confidence: .9, requiresHumanApproval: true
      }],
      selectedTopFive: ["finding-1-design"],
      status: "review_required"
    } as const;
    const tasks = improvementPlanToCodingTasks(plan);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.sourceActionId).toBe("finding-1-design");
    expect(tasks[0]?.requiresHumanApproval).toBe(true);
  });
});
