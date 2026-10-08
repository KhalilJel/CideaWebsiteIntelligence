import test from "node:test";
import assert from "node:assert/strict";
import { runValidationPipeline } from "../src/agents/validation-pipeline.js";

const baseObservation = {
  url: "https://cidealeads.com/",
  action: { type: "navigate" as const, target: "https://cidealeads.com/" },
  result: "success" as const,
  observation: "Page loaded successfully.",
  collectedAt: new Date().toISOString()
};

test("validation pipeline passes when JEV, TypeSafe and PixelJury pass", async () => {
  const result = await runValidationPipeline(
    "https://cidealeads.com/",
    [{ type: "navigate", target: "https://cidealeads.com/" }],
    {
      browser: { execute: async () => [baseObservation] },
      pixelJuryRunner: async () => ({
        url: "https://cidealeads.com/",
        score: 92,
        critique: "Looks good.",
        scoreJson: { score: 92 },
        findings: [],
        provider: "mock",
        collectedAt: new Date().toISOString()
      })
    }
  );

  assert.equal(result.status, "passed");
  assert.deepEqual(result.checks.map(check => check.status), ["passed", "passed", "passed"]);
});

test("validation pipeline fails when JEV interaction fails", async () => {
  const result = await runValidationPipeline(
    "https://cidealeads.com/",
    [{ type: "click", target: "#contact" }],
    {
      browser: {
        execute: async () => [{
          ...baseObservation,
          action: { type: "click", target: "#contact" },
          result: "failed",
          observation: "Contact button failed."
        }]
      },
      pixelJuryRunner: async () => ({
        url: "https://cidealeads.com/",
        score: 92,
        critique: "Looks good.",
        scoreJson: { score: 92 },
        findings: [],
        provider: "mock",
        collectedAt: new Date().toISOString()
      })
    }
  );

  assert.equal(result.status, "failed");
  assert.equal(result.checks.find(check => check.name === "JEV")?.status, "failed");
  assert.equal(result.checks.find(check => check.name === "TypeSafe")?.status, "passed");
});

test("validation pipeline fails on high-severity PixelJury findings", async () => {
  const result = await runValidationPipeline(
    "https://cidealeads.com/",
    [{ type: "navigate", target: "https://cidealeads.com/" }],
    {
      browser: { execute: async () => [baseObservation] },
      pixelJuryRunner: async () => ({
        url: "https://cidealeads.com/",
        score: 70,
        critique: "Critical contrast issue.",
        scoreJson: { score: 70 },
        findings: [{
          category: "UX",
          severity: "high",
          title: "Contrast issue",
          observation: "Primary CTA has insufficient contrast.",
          recommendation: "Increase contrast.",
          evidence: [{ sourceUrl: "https://cidealeads.com/", observation: "Contrast issue" }],
          confidence: 0.9
        }],
        provider: "mock",
        collectedAt: new Date().toISOString()
      })
    }
  );

  assert.equal(result.status, "failed");
  assert.equal(result.checks.find(check => check.name === "PixelJury")?.status, "failed");
});

test("validation pipeline is not ready when required external tools are absent", async () => {
  const result = await runValidationPipeline(
    "https://cidealeads.com/",
    [{ type: "navigate", target: "https://cidealeads.com/" }],
    { pixelJuryAvailable: false }
  );

  assert.equal(result.status, "not_ready");
  assert.ok(result.checks.every(check => check.status === "not_ready"));
});
