import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { runCursorAgent, type CursorAgentResult } from "../integrations/cursor-agent.js";
import type { CodingTask } from "../domain/coding-task.js";

type CommandResult = { exitCode: number | null; stdout: string; stderr: string };

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
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
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

export type CursorExecutionResult = {
  repositoryUrl: string;
  workspacePath: string;
  cursor?: CursorAgentResult;
  diff?: string;
  status: "completed" | "failed";
  error?: string;
};

export async function executeCodingTaskWithCursor(
  task: CodingTask,
  options: {
    repositoryUrl: string;
    ref?: string;
    timeoutMs?: number;
    keepWorkspace?: boolean;
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

    const diff = await runCommand(
      "git",
      ["diff", "--no-ext-diff", "--binary"],
      workspacePath,
      30_000
    );

    return {
      repositoryUrl: options.repositoryUrl,
      workspacePath,
      cursor,
      diff: diff.stdout,
      status: cursor.exitCode === 0 ? "completed" : "failed"
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
