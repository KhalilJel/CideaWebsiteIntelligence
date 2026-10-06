import test from "node:test";
import assert from "node:assert/strict";
import { reasonWithHermes } from "../src/agents/hermes-reasoning.js";

test("Hermes evidence-only mode never invents evidence", async () => {
  const result = await reasonWithHermes(
    {
      target: "CideaLead",
      websiteUrl: "https://example.com",
      collectedAt: new Date().toISOString(),
      sources: [{ url: "https://example.com", sourceType: "website", collectedAt: new Date().toISOString() }],
      signals: [],
      unresolvedQuestions: ["Need browser testing"]
    },
    [{
      category: "CRO",
      severity: "high",
      title: "No obvious contact path",
      observation: "No contact path detected",
      recommendation: "Add a clear contact path",
      evidence: [{ sourceUrl: "https://example.com", observation: "No contact path detected" }],
      confidence: 0.95
    }]
  );
  assert.equal(result.mode, "evidence_only");
  assert.deepEqual(result.priorities[0]?.evidenceUrls, ["https://example.com"]);
  assert.ok(result.unresolvedQuestions.includes("Need browser testing"));
});

test("Hermes accepts a valid structured LLM response", async () => {
  const result = await reasonWithHermes(
    {
      target: "CideaMarketing",
      websiteUrl: "https://example.com",
      collectedAt: new Date().toISOString(),
      sources: [],
      signals: [],
      unresolvedQuestions: []
    },
    [],
    { complete: async () => JSON.stringify({
      summary: "Evidence is insufficient for broad claims.",
      priorities: [],
      unresolvedQuestions: ["Need competitor research"]
    })}
  );
  assert.equal(result.mode, "llm");
  assert.equal(result.summary, "Evidence is insufficient for broad claims.");
});
