import type { FirecrawlClient } from "../integrations/firecrawl.js";
import { researchBrief, type WebsiteResearch } from "../domain/website-research.js";
import { websiteTargetSchema, type WebsiteTarget } from "../domain/website-audit.js";

export async function hermesResearch(
  input: { target: WebsiteTarget; websiteUrl: string },
  adapters: { firecrawl?: FirecrawlClient }
): Promise<WebsiteResearch> {
  const target = websiteTargetSchema.parse(input.target);
  const collectedAt = new Date().toISOString();
  const sources: WebsiteResearch["sources"] = [];
  const signals: WebsiteResearch["signals"] = [];

  if (adapters.firecrawl) {
    const p = await adapters.firecrawl.scrape(input.websiteUrl);
    sources.push({
      url: p.url,
      title: p.title,
      sourceType: "website",
      collectedAt,
      excerpt: p.markdown?.slice(0, 2000)
    });
    if (p.title) {
      signals.push({
        category: "SEO",
        claim: "The page exposes a document title.",
        evidence: p.title,
        sourceUrls: [p.url],
        confidence: 1
      });
    }
  }

  return {
    target,
    websiteUrl: input.websiteUrl,
    collectedAt,
    sources,
    signals,
    unresolvedQuestions: [
      researchBrief(target),
      "Run external context research before making competitor or market claims.",
      "Run browser testing before making interaction or conversion claims."
    ]
  };
}