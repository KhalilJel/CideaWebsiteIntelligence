import test from "node:test";
import assert from "node:assert/strict";
import {extractWebsiteSignals} from "../src/integrations/website-audit.js";
import {runDeterministicSpecialistAudits} from "../src/agents/specialist-audits.js";

test("extracts missing website signals",()=>{const s=extractWebsiteSignals("<html><head><title>Example</title></head><body>Hello</body></html>");assert.equal(s.title,"Example");assert.ok(s.flags.includes("MISSING_META_DESCRIPTION"));assert.ok(s.flags.includes("MISSING_VIEWPORT_META"));assert.ok(s.flags.includes("NO_OBVIOUS_CONTACT_PATH"));});
test("specialist audits turn signals into findings",()=>{const findings=runDeterministicSpecialistAudits({companyName:"Example",websiteUrl:"https://example.com",checkedAt:new Date().toISOString(),status:"AUDITED",https:true,flags:["MISSING_TITLE","NO_OBVIOUS_CONTACT_PATH"]});assert.equal(findings.length,2);assert.equal(findings[0]?.category,"SEO");});
