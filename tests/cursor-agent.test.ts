import test from "node:test";
import assert from "node:assert/strict";
import { codingTaskToCursorPrompt, runCursorAgent } from "../src/integrations/cursor-agent.js";
import type { CodingTask } from "../src/domain/coding-task.js";

const task: CodingTask = {
  id: "coding-finding-1-design",
  target: "CideaLead",
  websiteUrl: "https://cidealeads.com/",
  sourceActionId: "finding-1-design",
  priority: "P1",
  category: "DESIGN",
  problem: "Service cards are visually repetitive.",
  evidence: ["https://cidealeads.com/"],
  objective: "Improve hierarchy and conversion.",
  selectedAlternativeId: "asymmetric",
  selectedAlternativeLabel: "Asymmetric composition",
  decisionReasoning: "It best balances differentiation, UX and implementation complexity.",
  proposedChange: "Break the equal card geometry and create a stronger visual hierarchy.",
  expectedOutcome: "Improve hierarchy and conversion.",
  acceptanceCriteria: [
    "Implement the selected design direction.",
    "The identified DESIGN issue is addressed without introducing a new regression.",
    "Typecheck and tests pass."
  ],
  verification: ["npm run typecheck", "npm test"],
  nonGoals: ["No production deployment.", "No DNS or MX changes.", "Do not redesign unrelated sections."],
  requiresHumanApproval: true
};

test("Cursor prompt carries the decision context and safety boundaries", () => {
  const prompt = codingTaskToCursorPrompt(task);

  assert.match(prompt, /OBJECTIVE/);
  assert.match(prompt, /Improve hierarchy and conversion/);
  assert.match(prompt, /Asymmetric composition/);
  assert.match(prompt, /best balances differentiation/);
  assert.match(prompt, /No DNS or MX changes/);
  assert.match(prompt, /No production deployment/);
  assert.match(prompt, /npm run typecheck/);
});

test("Cursor Agent runner is injectable and receives headless CLI arguments", async () => {
  let receivedCommand = "";
  let receivedArgs: string[] = [];
  let receivedOptions: { cwd: string; timeoutMs: number } | undefined;

  const result = await runCursorAgent(task, "/workspace/cidea", {
    command: "agent",
    timeoutMs: 1234,
    runner: async (command, args, options) => {
      receivedCommand = command;
      receivedArgs = args;
      receivedOptions = options;
      return {
        exitCode: 0,
        stdout: JSON.stringify({ status: "completed" }),
        stderr: ""
      };
    }
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.parsedOutput, { status: "completed" });
  assert.equal(receivedCommand, "agent");
  assert.equal(receivedOptions?.cwd, "/workspace/cidea");
  assert.equal(receivedOptions?.timeoutMs, 1234);
  assert.equal(receivedArgs[0], "-p");
  assert.equal(receivedArgs[2], "--output-format");
  assert.equal(receivedArgs[3], "json");
  assert.equal(receivedArgs[4], "--workspace");
  assert.equal(receivedArgs[5], "/workspace/cidea");
  assert.match(receivedArgs[1] ?? "", /Asymmetric composition/);
});
