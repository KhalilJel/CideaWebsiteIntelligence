import { z } from "zod";

export const cideaTargetSchema = z.enum(["CideaLead", "CideaMarketing", "CideaConsulting"]);
export type CideaTarget = z.infer<typeof cideaTargetSchema>;

export const websiteTargetSchema = z.string().min(1).max(120);
export type WebsiteTarget = z.infer<typeof websiteTargetSchema>;

export const auditCategorySchema = z.enum(["UX","SEO","CRO","DESIGN","CONTENT","PERFORMANCE","TRUST"]);
export type AuditCategory = z.infer<typeof auditCategorySchema>;
export const severitySchema = z.enum(["low","medium","high","critical"]);
export const evidenceSchema = z.object({ sourceUrl: z.string().url(), observation: z.string().min(1) });
export const auditFindingSchema = z.object({
  category: auditCategorySchema, severity: severitySchema, title: z.string().min(1),
  observation: z.string().min(1), recommendation: z.string().min(1),
  evidence: z.array(evidenceSchema).min(1), confidence: z.number().min(0).max(1)
});
export const websiteAuditSchema = z.object({
  target: websiteTargetSchema, websiteUrl: z.string().url(), auditedAt: z.string().datetime(),
  scores: z.record(auditCategorySchema, z.number().int().min(0).max(100)),
  findings: z.array(auditFindingSchema), topPriorities: z.array(z.string()).max(5),
  status: z.enum(["draft","review_required","approved"])
});
export type WebsiteAudit = z.infer<typeof websiteAuditSchema>;
export type AuditFinding = z.infer<typeof auditFindingSchema>;

export const DEFAULT_TARGET_PRIORITIES: AuditCategory[] = ["CRO","TRUST","UX","SEO","CONTENT","DESIGN","PERFORMANCE"];
export const TARGET_PRIORITIES: Record<CideaTarget, AuditCategory[]> = {
  CideaLead: ["CRO","TRUST","UX","DESIGN","SEO","CONTENT","PERFORMANCE"],
  CideaMarketing: ["SEO","CONTENT","CRO","TRUST","DESIGN","UX","PERFORMANCE"],
  CideaConsulting: ["TRUST","CRO","CONTENT","UX","SEO","DESIGN","PERFORMANCE"]
};

export function prioritiesForTarget(target: WebsiteTarget): AuditCategory[] {
  return cideaTargetSchema.safeParse(target).success
    ? TARGET_PRIORITIES[target as CideaTarget]
    : DEFAULT_TARGET_PRIORITIES;
}