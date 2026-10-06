import type {AgentReachClient} from "../integrations/agent-reach.js";
import type {WebsiteResearch} from "../domain/website-research.js";

type ResearchSourceType = WebsiteResearch["sources"][number]["sourceType"];

function mapPlatformToSourceType(platform: string): ResearchSourceType {
  if (platform === "web") return "search";
  if (platform === "linkedin" || platform === "reddit" || platform === "twitter" || platform === "youtube") return "social";
  return "other";
}

const EXTERNAL_RESEARCH_QUESTION="Run external context research before making competitor or market claims.";

export async function enrichWithExternalResearch(r: WebsiteResearch, c?: AgentReachClient):Promise<WebsiteResearch> {
  if (!c) {
    return {
      ...r,
      unresolvedQuestions: [...r.unresolvedQuestions, "Agent Reach is not configured in this runtime."]
    };
  }

  try {
    const e = await c.search(`"${r.websiteUrl}" competitors customer reviews positioning`);
    return {
      ...r,
      sources: [
        ...r.sources,
        ...e.map(x => ({
          url: x.sourceUrl,
          title: x.title,
          sourceType: mapPlatformToSourceType(x.platform),
          collectedAt: x.collectedAt,
          excerpt: x.excerpt
        }))
      ],
      unresolvedQuestions: r.unresolvedQuestions.filter(q => q !== EXTERNAL_RESEARCH_QUESTION)
    };
  } catch (error) {
    const detail=error instanceof Error?error.message:"Unknown Agent Reach error";
    return {
      ...r,
      unresolvedQuestions: [
        ...r.unresolvedQuestions.filter(q=>q!==EXTERNAL_RESEARCH_QUESTION),
        `Agent Reach research failed: ${detail}`
      ]
    };
  }
}
