import { auditCandidate } from "../integrations/website-audit.js";
import {
  websiteTargetSchema,
  websiteAuditSchema,
  prioritiesForTarget,
  type AuditCategory
} from "../domain/website-audit.js";
import { cideaTargets } from "../domain/cidea-targets.js";

const url = process.argv[2];
const targetInput = process.argv[3];
const companyName = process.argv[4] ?? new URL(url ?? "https://invalid.local").hostname;

if (!url) {
  throw new Error("Usage: npm run audit:website -- <url> [target] [companyName]");
}

const target = websiteTargetSchema.parse(targetInput ?? companyName);
const result = await auditCandidate({ companyName, websiteUrl: url, sourceUrl: url });

const evidence = result.flags.map(flag => ({
  category: (
    flag.includes("TITLE") || flag.includes("META") ? "SEO" :
    flag.includes("CONTACT") ? "CRO" :
    flag.includes("VIEWPORT") ? "UX" :
    flag.includes("HTTPS") ? "TRUST" : "UX"
  ) as AuditCategory,
  severity: flag.includes("HTTP_ERROR") || flag.includes("BLOCKED") ? "critical" as const : "medium" as const,
  title: flag.replaceAll("_", " ").toLowerCase(),
  observation: flag,
  recommendation: "Review this signal before making a production change.",
  evidence: [{
    sourceUrl: result.finalUrl ?? url,
    observation: result.note ?? flag
  }],
  confidence: 0.9
}));

const score = (category: AuditCategory) =>
  Math.max(0, 80 - evidence
    .filter(item => item.category === category)
    .reduce((sum, item) => sum + (item.severity === "critical" ? 35 : 15), 0));

const audit = websiteAuditSchema.parse({
  target,
  websiteUrl: result.finalUrl ?? url,
  auditedAt: result.checkedAt,
  scores: {
    UX: score("UX"),
    SEO: score("SEO"),
    CRO: score("CRO"),
    DESIGN: 60,
    CONTENT: 60,
    PERFORMANCE: result.responseTimeMs && result.responseTimeMs < 1500 ? 75 : 55,
    TRUST: result.https ? 75 : 35
  },
  findings: evidence,
  topPriorities: prioritiesForTarget(target)
    .filter(category => evidence.some(item => item.category === category))
    .slice(0, 5)
    .map(category => evidence.find(item => item.category === category)!.title),
  status: "review_required"
});

const cideaContext = cideaTargets[target as keyof typeof cideaTargets];

console.log(JSON.stringify({
  ...audit,
  companyName,
  targetPurpose: cideaContext?.purpose,
  primaryQuestion: cideaContext?.primaryQuestion,
  websiteSignals: result
}, null, 2));
