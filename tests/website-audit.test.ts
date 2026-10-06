import test from "node:test";
import assert from "node:assert/strict";
import {extractWebsiteSignals} from "../src/integrations/website-audit.js";
import {runDeterministicSpecialistAudits} from "../src/agents/specialist-audits.js";
import {runBrowserJourney} from "../src/agents/browser-journey.js";

test("extracts missing website signals",()=>{const s=extractWebsiteSignals("<html><head><title>Example</title></head><body>Hello</body></html>");assert.equal(s.title,"Example");assert.ok(s.flags.includes("MISSING_META_DESCRIPTION"));assert.ok(s.flags.includes("MISSING_VIEWPORT_META"));assert.ok(s.flags.includes("NO_OBVIOUS_CONTACT_PATH"));});
test("specialist audits turn signals into findings",()=>{const findings=runDeterministicSpecialistAudits({companyName:"Example",websiteUrl:"https://example.com",checkedAt:new Date().toISOString(),status:"AUDITED",https:true,flags:["MISSING_TITLE","NO_OBVIOUS_CONTACT_PATH"]});assert.equal(findings.length,2);assert.equal(findings[0]?.category,"SEO");});

test("TypeSafe rejects malformed browser actions",async()=>{await assert.rejects(()=>runBrowserJourney({execute:async()=>[]} as never,[{type:"click",target:123}]));});
test("JEV observations are validated before audit",async()=>{const result=await runBrowserJourney({execute:async()=>[{url:"https://example.com",action:{type:"click",target:"#contact"},result:"failed",observation:"Contact button failed",collectedAt:new Date().toISOString()}]},[{type:"click",target:"#contact"}]);assert.equal(result.observations.length,1);assert.equal(result.summary.failureCount,1);});


test("does not infer missing contact paths from a client-rendered shell",()=>{const s=extractWebsiteSignals('<html><head><title>Example</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>');assert.equal(s.clientRenderedShell,true);assert.ok(!s.flags.includes("NO_OBVIOUS_CONTACT_PATH"));assert.ok(!s.flags.includes("NO_EMAIL_LINK_DETECTED"));assert.ok(s.flags.includes("CLIENT_RENDERED_APP"));});