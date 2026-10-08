import test from "node:test";
import assert from "node:assert/strict";
import { reasonWithHermes, imagineWithHermes } from "../src/agents/hermes-reasoning.js";
import { runHermesPipeline } from "../src/agents/hermes-pipeline.js";

test("Hermes evidence-only mode never invents evidence", async () => {
  const result = await reasonWithHermes({target:"CideaLead",websiteUrl:"https://example.com",collectedAt:new Date().toISOString(),sources:[{url:"https://example.com",sourceType:"website",collectedAt:new Date().toISOString()}],signals:[],unresolvedQuestions:["Need browser testing"]},[{category:"CRO",severity:"high",title:"No obvious contact path",observation:"No contact path detected",recommendation:"Add a clear contact path",evidence:[{sourceUrl:"https://example.com",observation:"No contact path detected"}],confidence:.95}]);
  assert.equal(result.mode,"evidence_only");
  assert.deepEqual(result.priorities[0]?.evidenceUrls,["https://example.com"]);
  assert.ok(result.unresolvedQuestions.includes("Need browser testing"));
});

test("Hermes accepts a valid structured LLM response", async () => {
  const result=await reasonWithHermes({target:"CideaMarketing",websiteUrl:"https://example.com",collectedAt:new Date().toISOString(),sources:[],signals:[],unresolvedQuestions:[]},[],{complete:async()=>JSON.stringify({summary:"Evidence is insufficient for broad claims.",priorities:[],unresolvedQuestions:["Need competitor research"]})});
  assert.equal(result.mode,"llm");
  assert.equal(result.summary,"Evidence is insufficient for broad claims.");
});

test("Hermes pipeline includes validated JEV browser evidence and produces a plan", async () => {
  const result=await runHermesPipeline({target:"CideaLead",websiteUrl:"https://example.com",enableFirecrawl:false,browser:{execute:async()=>[{url:"https://example.com/contact",action:{type:"click",target:"#contact"},result:"failed",observation:"Contact interaction failed",collectedAt:new Date().toISOString()}]},browserActions:[{type:"click",target:"#contact"}]});
  assert.equal(result.browser?.summary.failureCount,1);
  assert.ok(result.research.sources.some(source=>source.sourceType==="browser"));
  assert.ok(result.research.signals.some(signal=>signal.category==="UX"));
  assert.equal(result.hermes.mode,"evidence_only");
  assert.ok(result.hermes.priorities.some(priority=>priority.category==="UX"));
  assert.equal(result.improvementPlan.status,"review_required");
  assert.ok(result.improvementPlan.actions.some(action=>action.priority==="P1"));
  assert.ok(result.improvementPlan.actions.some(action=>action.requiresHumanApproval));
});

test("Hermes pipeline consumes injected Agent Reach evidence", async () => {
  const result=await runHermesPipeline({target:"CideaMarketing",websiteUrl:"https://example.com",enableFirecrawl:false,agentReach:{read:async()=>({sourceUrl:"https://reddit.com/r/example",platform:"reddit",title:"Example discussion",excerpt:"Public customer discussion",collectedAt:new Date().toISOString()}),search:async()=>[{sourceUrl:"https://reddit.com/r/example",platform:"reddit",title:"Example discussion",excerpt:"Public customer discussion",collectedAt:new Date().toISOString()}]}});
  assert.ok(result.research.sources.some(source=>source.sourceType==="social"));
  assert.ok(result.research.sources.some(source=>source.url==="https://reddit.com/r/example"));
  assert.ok(!result.research.unresolvedQuestions.includes("Run external context research before making competitor or market claims."));
});

test("Hermes Imagine generates multiple materially different alternatives", async () => {
  const result = await imagineWithHermes(
    {
      target: "CideaLead",
      websiteUrl: "https://example.com",
      collectedAt: new Date().toISOString(),
      sources: [],
      signals: [],
      unresolvedQuestions: []
    },
    [{
      category: "DESIGN",
      severity: "medium",
      title: "Repeated cards",
      observation: "Service cards have repetitive visual treatment.",
      recommendation: "Improve visual differentiation.",
      evidence: [{ sourceUrl: "https://example.com", observation: "Repeated cards" }],
      confidence: 0.9
    }],
    {
      complete: async () => JSON.stringify({
        proposals: [{
          findingKey: "DESIGN:Repeated cards",
          objective: "Improve hierarchy and conversion while preserving Cidea Lead's lead-generation purpose.",
          alternatives: [
            { id: "editorial", label: "Editorial hierarchy", description: "Use a stronger editorial composition.", rationale: "Creates hierarchy without adding interaction complexity.", estimatedComplexity: "medium" },
            { id: "asymmetric", label: "Asymmetric composition", description: "Break equal card geometry.", rationale: "Reduces repetition and increases differentiation.", estimatedComplexity: "medium" },
            { id: "grouping", label: "Grouped system", description: "Group services by strategic role.", rationale: "Creates semantic hierarchy.", estimatedComplexity: "high" }
          ]
        }]
      })
    }
  );

  assert.equal(result.mode, "llm");
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0]?.alternatives.length, 3);
  assert.equal(new Set(result.proposals[0]?.alternatives.map(a => a.label)).size, 3);
});
