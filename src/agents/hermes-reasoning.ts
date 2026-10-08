import type { WebsiteResearch } from "../domain/website-research.js";
import type { AuditFinding } from "../domain/website-audit.js";
import type { HermesLLMClient } from "../integrations/hermes-llm.js";
import { decisionEvaluationSchema, type DesignAlternative } from "../domain/improvement-plan.js";

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

export type HermesDesignDecision = {
  findingKey: string;
  selectedAlternativeId: string;
  evaluations: Record<string, {
    criteria: {
      conversion: number;
      brandFit: number;
      ux: number;
      hierarchy: number;
      differentiation: number;
      complexity: number;
    };
    totalScore: number;
  }>;
  reasoning: string;
  rejectedAlternativeIds: string[];
  mode: "llm" | "fallback";
};

const BUSINESS_OBJECTIVES: Record<string, string> = {
  CideaLead: "Create more qualified leads and sales conversations.",
  CideaMarketing: "Demonstrate marketing competence and create demand.",
  CideaConsulting: "Build authority and create consulting opportunities."
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

function businessObjective(target: WebsiteResearch["target"]): string {
  return BUSINESS_OBJECTIVES[target] ?? "Improve the website's stated business objective.";
}

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
        businessObjective: businessObjective(research.target),
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

const decideSystem = [
  "You are Hermes, Cidea's decision intelligence layer.",
  "Choose the strongest design alternative using only supplied evidence, the business objective and the supplied alternatives.",
  "Evaluate every alternative on exactly six criteria: conversion, brandFit, ux, hierarchy, differentiation, complexity.",
  "Score each criterion from 0 to 10. For complexity, a higher score means simpler and safer implementation.",
  "totalScore must equal the sum of the six criterion scores.",
  "Select exactly one alternative. Explain the tradeoffs and why the selected alternative wins.",
  "Do not invent metrics, user research, competitor facts or observations.",
  "Return JSON with selectedAlternativeId, evaluations, reasoning and rejectedAlternativeIds."
].join(" ");

function fallbackDecision(
  research: WebsiteResearch,
  finding: AuditFinding,
  proposal: HermesDesignProposal
): HermesDesignDecision {
  const evaluations = Object.fromEntries(proposal.alternatives.map((alternative, index) => {
    const complexity = alternative.estimatedComplexity === "low" ? 10 : alternative.estimatedComplexity === "medium" ? 7 : 4;
    const structural = /struct|editorial|group|hierarchy/i.test(
      `${alternative.label} ${alternative.description}`
    );
    const distinctive = /distinct|asym|differenti|novel/i.test(
      `${alternative.label} ${alternative.description}`
    );
    const severityBoost = finding.severity === "critical" || finding.severity === "high" ? 1 : 0;
    const criteria = {
      conversion: Math.min(10, 7 + severityBoost + (index === 0 ? 1 : 0)),
      brandFit: 8,
      ux: Math.min(10, 7 + (structural ? 2 : 0)),
      hierarchy: Math.min(10, 7 + (structural ? 2 : 0)),
      differentiation: Math.min(10, 7 + (distinctive ? 2 : 0)),
      complexity
    };
    return [alternative.id, {
      criteria,
      totalScore: Object.values(criteria).reduce((sum, score) => sum + score, 0)
    }];
  }));

  const selected = [...proposal.alternatives]
    .sort((a, b) => (evaluations[b.id]?.totalScore ?? 0) - (evaluations[a.id]?.totalScore ?? 0))[0];

  return {
    findingKey: proposal.findingKey,
    selectedAlternativeId: selected.id,
    evaluations,
    reasoning: `Selected ${selected.label} because it provides the strongest balance of the supplied evidence, the ${research.target} objective and implementation complexity. No unsupported external assumptions were used.`,
    rejectedAlternativeIds: proposal.alternatives.filter((alternative) => alternative.id !== selected.id).map((alternative) => alternative.id),
    mode: "fallback"
  };
}

function validateDecision(
  proposal: HermesDesignProposal,
  candidate: Partial<HermesDesignDecision>
): HermesDesignDecision {
  const ids = new Set(proposal.alternatives.map((alternative) => alternative.id));
  if (typeof candidate.selectedAlternativeId !== "string" || !ids.has(candidate.selectedAlternativeId)) {
    throw new Error("Hermes selected an unknown alternative");
  }
  if (!candidate.evaluations || typeof candidate.evaluations !== "object") {
    throw new Error("Hermes returned no evaluations");
  }

  const evaluations = candidate.evaluations as HermesDesignDecision["evaluations"];
  if (Object.keys(evaluations).length !== proposal.alternatives.length) {
    throw new Error("Hermes must evaluate every alternative");
  }

  for (const alternative of proposal.alternatives) {
    const evaluation = evaluations[alternative.id];
    const parsed = decisionEvaluationSchema.safeParse(evaluation);
    if (!parsed.success) throw new Error("Invalid Hermes decision evaluation");
    const sum = Object.values(parsed.data.criteria).reduce((total, score) => total + score, 0);
    if (parsed.data.totalScore !== sum) throw new Error("Decision totalScore must equal criterion sum");
  }

  if (typeof candidate.reasoning !== "string" || !candidate.reasoning.trim()) {
    throw new Error("Hermes returned no decision reasoning");
  }

  const rejectedAlternativeIds = candidate.rejectedAlternativeIds;
  if (
    !Array.isArray(rejectedAlternativeIds) ||
    rejectedAlternativeIds.some((id) => typeof id !== "string" || !ids.has(id)) ||
    rejectedAlternativeIds.includes(candidate.selectedAlternativeId) ||
    rejectedAlternativeIds.length !== proposal.alternatives.length - 1
  ) {
    throw new Error("Invalid rejected alternative set");
  }

  return {
    findingKey: proposal.findingKey,
    selectedAlternativeId: candidate.selectedAlternativeId,
    evaluations,
    reasoning: candidate.reasoning,
    rejectedAlternativeIds,
    mode: "llm"
  };
}

export async function decideWithHermes(
  research: WebsiteResearch,
  finding: AuditFinding,
  proposal: HermesDesignProposal,
  client?: HermesLLMClient
): Promise<HermesDesignDecision> {
  if (!client) return fallbackDecision(research, finding, proposal);

  try {
    const raw = await client.complete({
      system: decideSystem,
      user: JSON.stringify({
        target: research.target,
        websiteUrl: research.websiteUrl,
        businessObjective: businessObjective(research.target),
        finding: {
          findingKey: proposal.findingKey,
          category: finding.category,
          severity: finding.severity,
          title: finding.title,
          observation: finding.observation,
          recommendation: finding.recommendation,
          evidence: finding.evidence
        },
        objective: proposal.objective,
        alternatives: proposal.alternatives
      })
    });

    return validateDecision(
      proposal,
      JSON.parse(raw) as Partial<HermesDesignDecision>
    );
  } catch {
    return fallbackDecision(research, finding, proposal);
  }
}

export async function decideAllWithHermes(
  research: WebsiteResearch,
  findings: AuditFinding[],
  proposals: HermesDesignProposal[],
  client?: HermesLLMClient
): Promise<HermesDesignDecision[]> {
  const decisions: HermesDesignDecision[] = [];
  for (const proposal of proposals) {
    const finding = findings.find((candidate) => `${candidate.category}:${candidate.title}` === proposal.findingKey);
    if (finding) decisions.push(await decideWithHermes(research, finding, proposal, client));
  }
  return decisions;
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