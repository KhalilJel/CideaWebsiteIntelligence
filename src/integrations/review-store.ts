import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { CodingTask } from "../domain/coding-task.js";
import type { ValidationPipelineResult } from "../agents/validation-pipeline.js";
import type { WorkspaceVerification } from "../agents/cursor-execution.js";

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
