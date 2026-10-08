import type { WebsiteResearch } from "../domain/website-research.js";
import type { AuditFinding } from "../domain/website-audit.js";
import type { HermesLLMClient } from "../integrations/hermes-llm.js";
import type { DesignAlternative } from "../domain/improvement-plan.js";

export type HermesDecision = {
  summary: string;
  priorities: Array<{
    category: AuditFinding["category"];
    reason: string;
    evidenceUrls: string[];
  }>;
  unresolvedQuestions: string[];
  mode: "llm" | "evidence_only";
};


export type HermesDesignProposal = {
  findingKey: string;
  objective: string;
  alternatives: DesignAlternative[];
};

const imagineSystem = [
  "You are Hermes, Cidea's website design intelligence layer.",
  "Generate multiple materially different design solutions for each supplied evidence-backed finding.",
  "Use only supplied evidence and the stated Cidea business objective. Never invent observations.",
  "Do not default to the smallest change. Alternatives must represent genuinely different solution directions when the evidence allows it.",
  "Return JSON with an array named proposals.",
  "Each proposal must contain findingKey, objective and 2 to 5 alternatives.",
  "Each alternative must contain id, label, description, rationale and estimatedComplexity (low, medium or high)."
].join(" ");

function deterministicImagine(research: WebsiteResearch, findings: AuditFinding[]): HermesDesignProposal[] {
  return findings.map((finding) => ({
    findingKey: `${finding.category}:${finding.title}`,
    objective:
      research.target === "CideaLead"
        ? "Improve conversion and reduce friction while preserving Cidea Lead's lead-generation purpose."
        : research.target === "CideaMarketing"
          ? "Improve demand generation, clarity and marketing authority while preserving Cidea Marketing's purpose."
          : research.target === "CideaConsulting"
            ? "Improve authority, trust and consulting opportunity creation while preserving Cidea Consulting's purpose."
            : "Improve the identified experience without changing the site's strategic purpose.",
    alternatives: [
      {
        id: "minimal-refinement",
        label: "Minimal refinement",
        description: finding.recommendation,
        rationale: "Addresses the evidence-backed problem with limited implementation surface.",
        estimatedComplexity: "low"
      },
      {
        id: "structural-rethink",
        label: "Structural rethink",
        description: "Reorganize the affected experience around a stronger information hierarchy.",
        rationale: "Addresses the underlying structure rather than only polishing the existing component.",
        estimatedComplexity: "medium"
      },
      {
        id: "distinctive-direction",
        label: "Distinctive design direction",
        description: "Introduce a materially different visual or interaction pattern tailored to the identified problem.",
        rationale: "Creates a stronger differentiation opportunity when the existing pattern is visually generic.",
        estimatedComplexity: "medium"
      }
    ]
  }));
}

export async function imagineWithHermes(
  research: WebsiteResearch,
  findings: AuditFinding[],
  client?: HermesLLMClient
): Promise<{ proposals: HermesDesignProposal[]; mode: "llm" | "fallback" }> {
  if (!client || !findings.length) {
    return { proposals: deterministicImagine(research, findings), mode: "fallback" };
  }

  try {
    const raw = await client.complete({
      system: imagineSystem,
      user: JSON.stringify({
        target: research.target,
        websiteUrl: research.websiteUrl,
        businessObjective:
          research.target === "CideaLead"
            ? "Create more qualified leads and sales conversations."
            : research.target === "CideaMarketing"
              ? "Demonstrate marketing competence and create demand."
              : research.target === "CideaConsulting"
                ? "Build authority and create consulting opportunities."
                : "Improve the website's stated business objective.",
        findings: findings.map((finding) => ({
          findingKey: `${finding.category}:${finding.title}`,
          category: finding.category,
          severity: finding.severity,
          observation: finding.observation,
          recommendation: finding.recommendation,
          evidence: finding.evidence
        }))
      })
    });

    const parsed = JSON.parse(raw) as { proposals?: unknown };
    if (!Array.isArray(parsed.proposals)) throw new Error("Invalid Hermes Imagine JSON");

    const proposals = parsed.proposals.map((proposal) => {
      const candidate = proposal as HermesDesignProposal;
      if (
        typeof candidate.findingKey !== "string" ||
        typeof candidate.objective !== "string" ||
        !Array.isArray(candidate.alternatives) ||
        candidate.alternatives.length < 2 ||
        candidate.alternatives.length > 5
      ) throw new Error("Invalid Hermes design proposal");

      const alternatives = candidate.alternatives.map((alternative) => ({
        id: String(alternative.id),
        label: String(alternative.label),
        description: String(alternative.description),
        rationale: String(alternative.rationale),
        estimatedComplexity: alternative.estimatedComplexity
      })) satisfies DesignAlternative[];

      return { findingKey: candidate.findingKey, objective: candidate.objective, alternatives };
    });

    return { proposals, mode: "llm" };
  } catch {
    return { proposals: deterministicImagine(research, findings), mode: "fallback" };
  }
}

const system = [
  "You are Hermes, the top-level website intelligence orchestrator for Cidea.",
  "Use only supplied evidence. Never invent facts, competitors, metrics or observations.",
  "Return concise JSON with keys summary, priorities, unresolvedQuestions.",
  "priorities must contain category, reason and evidenceUrls.",
  "If evidence is insufficient, put the question in unresolvedQuestions instead of guessing."
].join(" ");

const SEVERITY_RANK: Record<AuditFinding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

function evidenceOnly(
  research: WebsiteResearch,
  findings: AuditFinding[]
): HermesDecision {
  const priorities = findings
    .slice()
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        b.confidence - a.confidence
    )
    .slice(0, 5)
    .map((finding) => ({
      category: finding.category,
      reason: finding.title,
      evidenceUrls: finding.evidence.map((evidence) => evidence.sourceUrl)
    }));

  return {
    summary: findings.length
      ? `Found ${findings.length} evidence-backed improvement opportunities.`
      : "No deterministic issues were found; deeper research is still required before making broad claims.",
    priorities,
    unresolvedQuestions: research.unresolvedQuestions,
    mode: "evidence_only"
  };
}

export async function reasonWithHermes(
  research: WebsiteResearch,
  findings: AuditFinding[],
  client?: HermesLLMClient
): Promise<HermesDecision> {
  if (!client) return evidenceOnly(research, findings);

  try {
    const raw = await client.complete({
      system,
      user: JSON.stringify({ research, findings })
    });
    const parsed = JSON.parse(raw) as Partial<HermesDecision>;

    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.priorities) ||
      !Array.isArray(parsed.unresolvedQuestions)
    ) {
      throw new Error("Invalid Hermes JSON");
    }

    const priorities = parsed.priorities.filter(
      (priority): priority is HermesDecision["priorities"][number] =>
        Boolean(priority) &&
        typeof priority === "object" &&
        typeof priority.category === "string" &&
        typeof priority.reason === "string" &&
        Array.isArray(priority.evidenceUrls) &&
        priority.evidenceUrls.every((url) => typeof url === "string")
    );

    return {
      summary: parsed.summary,
      priorities,
      unresolvedQuestions: parsed.unresolvedQuestions.filter(
        (question): question is string => typeof question === "string"
      ),
      mode: "llm"
    };
  } catch {
    return evidenceOnly(research, findings);
  }
}
