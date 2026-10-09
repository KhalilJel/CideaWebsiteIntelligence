import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { CodingTask } from "../domain/coding-task.js";
import type { ValidationPipelineResult } from "../agents/validation-pipeline.js";
import type { WorkspaceVerification } from "../agents/cursor-execution.js";
import { createHumanReviewRequest, resolveHumanReview, type HumanReviewDecision } from "../domain/human-review.js";

export type ReviewPersistenceStatus = "persisted" | "not_configured" | "failed";

export type ReviewRecordInput = {
  task: CodingTask;
  repositoryUrl: string;
  websiteUrl: string;
  diff: string;
  cursorStatus: "completed" | "failed";
  verification?: WorkspaceVerification;
  validation?: ValidationPipelineResult;
};

export type ReviewPersistenceResult = {
  status: ReviewPersistenceStatus;
  reviewId?: string;
  error?: string;
};

let pool: Pool | undefined;

function getPool(): Pool | undefined {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return undefined;
  if (!pool) {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      max: 2
    });
  }
  return pool;
}

export async function persistReviewRecord(input: ReviewRecordInput): Promise<ReviewPersistenceResult> {
  const database = getPool();
  if (!database) {
    return {
      status: "not_configured",
      error: "DATABASE_URL is not configured; the proposal cannot enter durable human review."
    };
  }

  const reviewId = randomUUID();
  const validationStatus = input.validation?.status ?? "not_ready";
  try {
    await database.query(`
      CREATE TABLE IF NOT EXISTS cidea_website_review_records (
        review_id TEXT PRIMARY KEY,
        website_url TEXT NOT NULL,
        repository_url TEXT NOT NULL,
        task_id TEXT NOT NULL,
        task_json JSONB NOT NULL,
        diff_text TEXT NOT NULL,
        cursor_status TEXT NOT NULL CHECK (cursor_status IN ('completed', 'failed')),
        validation_status TEXT NOT NULL CHECK (validation_status IN ('passed', 'failed', 'not_ready')),
        verification_json JSONB,
        validation_json JSONB,
        review_status TEXT NOT NULL DEFAULT 'review_required'
          CHECK (review_status IN ('review_required', 'approved', 'rejected', 'iteration_required')),
        reviewer TEXT,
        review_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ
      )
    `);

    await database.query(
      `INSERT INTO cidea_website_review_records
        (review_id, website_url, repository_url, task_id, task_json, diff_text,
         cursor_status, validation_status, verification_json, validation_json)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb, $10::jsonb)`,
      [
        reviewId,
        input.websiteUrl,
        input.repositoryUrl,
        input.task.id,
        JSON.stringify(input.task),
        input.diff,
        input.cursorStatus,
        validationStatus,
        input.verification ? JSON.stringify(input.verification) : null,
        input.validation ? JSON.stringify(input.validation) : null
      ]
    );

    return { status: "persisted", reviewId };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}


export type StoredReviewRecord = {
  reviewId: string;
  websiteUrl: string;
  repositoryUrl: string;
  task: CodingTask;
  diff: string;
  cursorStatus: "completed" | "failed";
  validationStatus: "passed" | "failed" | "not_ready";
  verification: WorkspaceVerification | null;
  validation: ValidationPipelineResult | null;
  reviewStatus: "review_required" | "approved" | "rejected" | "iteration_required";
  reviewer: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export async function getReviewRecord(reviewId: string): Promise<StoredReviewRecord | undefined> {
  const database = getPool();
  if (!database) throw new Error("DATABASE_URL is not configured.");
  const result = await database.query(
    `SELECT review_id, website_url, repository_url, task_json, diff_text, cursor_status,
            validation_status, verification_json, validation_json, review_status, reviewer,
            review_note, created_at, reviewed_at
     FROM cidea_website_review_records WHERE review_id = $1`,
    [reviewId]
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    reviewId: row.review_id,
    websiteUrl: row.website_url,
    repositoryUrl: row.repository_url,
    task: row.task_json,
    diff: row.diff_text,
    cursorStatus: row.cursor_status,
    validationStatus: row.validation_status,
    verification: row.verification_json,
    validation: row.validation_json,
    reviewStatus: row.review_status,
    reviewer: row.reviewer,
    reviewNote: row.review_note,
    createdAt: new Date(row.created_at).toISOString(),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null
  };
}

export async function decideReviewRecord(
  reviewId: string,
  decision: HumanReviewDecision
): Promise<{ reviewId: string; reviewStatus: StoredReviewRecord["reviewStatus"] }> {
  const database = getPool();
  if (!database) throw new Error("DATABASE_URL is not configured.");

  const current = await getReviewRecord(reviewId);
  if (!current) throw new Error("Review record not found.");
  if (current.reviewStatus !== "review_required") {
    throw new Error(`Review record is already resolved: ${current.reviewStatus}.`);
  }

  const request = createHumanReviewRequest(current.task, current.validationStatus);
  const resolved = resolveHumanReview(request, decision);
  const nextStatus = resolved.nextStatus === "approved"
    ? "approved"
    : resolved.nextStatus === "rejected"
      ? "rejected"
      : "iteration_required";

  const updated = await database.query(
    `UPDATE cidea_website_review_records
     SET review_status = $2, reviewer = $3, review_note = $4, reviewed_at = $5
     WHERE review_id = $1 AND review_status = 'review_required'`,
    [reviewId, nextStatus, decision.reviewer, decision.note, decision.reviewedAt]
  );
  if (updated.rowCount !== 1) throw new Error("Review record changed concurrently; reload before deciding.");
  return { reviewId, reviewStatus: nextStatus };
}
