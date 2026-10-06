import test from "node:test";
import assert from "node:assert/strict";
import { reasonWithHermes } from "../src/agents/hermes-reasoning.js";
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
  assert.equal(result.hermes.priorities[0]?.category,"UX");
  assert.equal(result.improvementPlan.status,"review_required");
  assert.equal(result.improvementPlan.actions[0]?.priority,"P1");
  assert.equal(result.improvementPlan.actions[0]?.requiresHumanApproval,true);
});

test("Hermes pipeline consumes injected Agent Reach evidence", async () => {
  const result=await runHermesPipeline({target:"CideaMarketing",websiteUrl:"https://example.com",enableFirecrawl:false,agentReach:{read:async()=>({sourceUrl:"https://reddit.com/r/example",platform:"reddit",title:"Example discussion",excerpt:"Public customer discussion",collectedAt:new Date().toISOString()}),search:async()=>[{sourceUrl:"https://reddit.com/r/example",platform:"reddit",title:"Example discussion",excerpt:"Public customer discussion",collectedAt:new Date().toISOString()}]}});
  assert.ok(result.research.sources.some(source=>source.sourceType==="social"));
  assert.ok(result.research.sources.some(source=>source.url==="https://reddit.com/r/example"));
  assert.ok(!result.research.unresolvedQuestions.includes("Run external context research before making competitor or market claims."));
});
