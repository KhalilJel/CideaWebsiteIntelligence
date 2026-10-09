import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { runCursorAgent, type CursorAgentResult } from "../integrations/cursor-agent.js";
import { createJEVBrowserClient } from "../integrations/jev-browser.js";
import { pixelJuryEnabled, runPixelJury, type PixelJuryResult } from "../integrations/pixeljury.js";
import { runValidationPipeline, type ValidationPipelineResult } from "./validation-pipeline.js";
import type { BrowserAction } from "../integrations/jev-browser.js";
import type { CodingTask } from "../domain/coding-task.js";
import { persistReviewRecord, type ReviewPersistenceResult } from "../integrations/review-store.js";

type CommandResult = { exitCode: number | null; stdout: string; stderr: string };

function workspaceEnvironment(): NodeJS.ProcessEnv {
  const allowed = [
    "PATH", "HOME", "USERPROFILE", "TMPDIR", "TEMP", "TMP",
    "LANG", "LC_ALL", "SYSTEMROOT", "WINDIR", "CI"
  ];
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowed) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  env.GIT_TERMINAL_PROMPT = "0";
  env.CI = "true";
  env.NPM_CONFIG_UPDATE_NOTIFIER = "false";
  return env;
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: workspaceEnvironment(),
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      if (!settled) {
        settled = true;
        reject(new Error(`${command} timed out after ${timeoutMs}ms.`));
      }
    }, timeoutMs);

    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });

    child.on("error", error => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    child.on("close", exitCode => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve({ exitCode, stdout, stderr });
      }
    });
  });
}

export type WorkspaceVerification = {
  installStatus: "passed" | "failed" | "not_run";
  buildStatus: "passed" | "failed" | "not_run";
  previewStatus: "passed" | "failed" | "not_run";
  previewUrl?: string;
  pixelJury?: PixelJuryResult;
  error?: string;
};

export type CursorExecutionResult = {
  repositoryUrl: string;
  workspacePath: string;
  cursor?: CursorAgentResult;
  diff?: string;
  status: "completed" | "failed";
  error?: string;
  verification?: WorkspaceVerification;
  validation?: ValidationPipelineResult;
  reviewPersistence?: ReviewPersistenceResult;
};

function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5000);
    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function waitForPreview(url: string, child: ChildProcess, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "Preview server did not become ready.";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Preview server exited early with code ${child.exitCode}.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return;
      lastError = `Preview returned HTTP ${response.status}.`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Preview was not ready after ${timeoutMs}ms: ${lastError}`);
}

async function verifyWorkspace(
  workspacePath: string,
  browserActions: BrowserAction[]
): Promise<{ verification: WorkspaceVerification; validation?: ValidationPipelineResult }> {
  const verification: WorkspaceVerification = {
    installStatus: "not_run",
    buildStatus: "not_run",
    previewStatus: "not_run"
  };

  const install = await runCommand("npm", ["install", "--no-audit", "--no-fund"], workspacePath, 180_000);
  if (install.exitCode !== 0) {
    verification.installStatus = "failed";
    verification.error = `npm install failed: ${(install.stderr || install.stdout).slice(-2000)}`;
    return { verification };
  }
  verification.installStatus = "passed";

  const build = await runCommand("npm", ["run", "build"], workspacePath, 180_000);
  if (build.exitCode !== 0) {
    verification.buildStatus = "failed";
    verification.error = `npm run build failed: ${(build.stderr || build.stdout).slice(-3000)}`;
    return { verification };
  }
  verification.buildStatus = "passed";

  const port = 4173;
  const previewUrl = `http://127.0.0.1:${port}`;
  const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: workspacePath,
    shell: false,
    env: workspaceEnvironment(),
    stdio: ["ignore", "pipe", "pipe"]
  });

  let previewStderr = "";
  preview.stderr.on("data", chunk => { previewStderr += chunk.toString(); });
  try {
    await waitForPreview(previewUrl, preview);
    verification.previewStatus = "passed";
    verification.previewUrl = previewUrl;

    const validation = await runValidationPipeline(
      previewUrl,
      browserActions,
      {
        browser: createJEVBrowserClient(),
        pixelJuryAvailable: pixelJuryEnabled()
      }
    );
    verification.pixelJury = validation.pixelJury;
    return { verification, validation };
  } catch (error) {
    verification.previewStatus = "failed";
    verification.error = `${error instanceof Error ? error.message : String(error)} ${previewStderr.slice(-1500)}`.trim();
    return { verification };
  } finally {
    await stopProcess(preview);
  }
}

export async function executeCodingTaskWithCursor(
  task: CodingTask,
  options: {
    repositoryUrl: string;
    ref?: string;
    timeoutMs?: number;
    keepWorkspace?: boolean;
    browserActions?: BrowserAction[];
  }
): Promise<CursorExecutionResult> {
  const root = await mkdtemp(join(tmpdir(), "cidea-cursor-"));
  const workspacePath = join(root, "repo");

  try {
    const clone = await runCommand(
      "git",
      ["clone", "--depth", "1", ...(options.ref ? ["--branch", options.ref] : []), options.repositoryUrl, workspacePath],
      root,
      120_000
    );

    if (clone.exitCode !== 0) {
      throw new Error(`Could not clone target repository: ${clone.stderr || clone.stdout}`);
    }

    const cursor = await runCursorAgent(task, workspacePath, {
      timeoutMs: options.timeoutMs ?? 15 * 60 * 1000
    });

    const includeUntracked = await runCommand(
      "git",
      ["add", "--intent-to-add", "--", "."],
      workspacePath,
      30_000
    );
    if (includeUntracked.exitCode !== 0) {
      throw new Error(`Could not prepare untracked files for diff capture: ${includeUntracked.stderr || includeUntracked.stdout}`);
    }

    const diff = await runCommand(
      "git",
      ["diff", "--no-ext-diff", "--binary"],
      workspacePath,
      30_000
    );

    if (cursor.exitCode !== 0) {
      return {
        repositoryUrl: options.repositoryUrl,
        workspacePath,
        cursor,
        diff: diff.stdout,
        status: "failed",
        error: `Cursor Agent exited with code ${cursor.exitCode}.`
      };
    }

    if (!diff.stdout.trim()) {
      return {
        repositoryUrl: options.repositoryUrl,
        workspacePath,
        cursor,
        diff: "",
        status: "failed",
        error: "Cursor Agent completed without producing a reviewable diff."
      };
    }

    const { verification, validation } = await verifyWorkspace(workspacePath, options.browserActions ?? []);
    const verificationPassed = verification.installStatus === "passed"
      && verification.buildStatus === "passed"
      && verification.previewStatus === "passed";

    const reviewPersistence = await persistReviewRecord({
      task,
      repositoryUrl: options.repositoryUrl,
      websiteUrl: task.websiteUrl,
      diff: diff.stdout,
      cursorStatus: verificationPassed ? "completed" : "failed",
      verification,
      validation
    });

    return {
      repositoryUrl: options.repositoryUrl,
      workspacePath,
      cursor,
      diff: diff.stdout,
      status: verificationPassed ? "completed" : "failed",
      error: verification.error,
      verification,
      validation,
      reviewPersistence
    };
  } catch (error) {
    return {
      repositoryUrl: options.repositoryUrl,
      workspacePath,
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    if (!options.keepWorkspace) {
      await rm(root, { recursive: true, force: true });
    }
  }
}
