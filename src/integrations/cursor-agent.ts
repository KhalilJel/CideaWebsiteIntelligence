import { spawn } from "node:child_process";
import type { CodingTask } from "../domain/coding-task.js";

export type CursorAgentProcessResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type CursorAgentProcessRunner = (
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs: number }
) => Promise<CursorAgentProcessResult>;

export type CursorAgentResult = CursorAgentProcessResult & {
  parsedOutput?: unknown;
};

const defaultRunner: CursorAgentProcessRunner = (command, args, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      if (!settled) {
        settled = true;
        reject(new Error(`Cursor Agent timed out after ${options.timeoutMs}ms.`));
      }
    }, options.timeoutMs);

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

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

function selectedAlternative(task: CodingTask): string {
  return [
    `ID: ${task.selectedAlternativeId}`,
    `Label: ${task.selectedAlternativeLabel}`,
    `Change: ${task.proposedChange}`
  ].join("\n");
}

export function codingTaskToCursorPrompt(task: CodingTask): string {
  return [
    "You are implementing a Cidea Website Intelligence CodingTask.",
    "Work only on the supplied task. Do not redesign unrelated areas.",
    "Do not deploy to production.",
    "Do not change DNS or MX records.",
    "",
    "OBJECTIVE",
    task.objective,
    "",
    "PROBLEM",
    task.problem,
    "",
    "SELECTED DESIGN DIRECTION",
    selectedAlternative(task),
    "",
    "WHY THIS DIRECTION WAS SELECTED",
    task.decisionReasoning,
    "",
    "EVIDENCE",
    ...task.evidence.map(url => `- ${url}`),
    "",
    "ACCEPTANCE CRITERIA",
    ...task.acceptanceCriteria.map(item => `- ${item}`),
    "",
    "VERIFICATION",
    ...task.verification.map(item => `- ${item}`),
    "",
    "NON-GOALS",
    ...task.nonGoals.map(item => `- ${item}`),
    "",
    "IMPLEMENTATION RULE",
    "Inspect the existing code before editing. Preserve established patterns. Make the smallest coherent implementation that fully realizes the selected direction. Run the requested verification before reporting completion.",
    "",
    "When finished, report what changed, what verification passed or failed, and any remaining risk."
  ].join("\n");
}

export async function runCursorAgent(
  task: CodingTask,
  workspacePath: string,
  options: {
    command?: string;
    timeoutMs?: number;
    runner?: CursorAgentProcessRunner;
  } = {}
): Promise<CursorAgentResult> {
  const command = options.command ?? process.env.CURSOR_AGENT_COMMAND ?? "agent";
  const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
  const runner = options.runner ?? defaultRunner;
  const prompt = codingTaskToCursorPrompt(task);

  const result = await runner(
    command,
    ["-p", prompt, "--output-format", "json", "--workspace", workspacePath],
    { cwd: workspacePath, timeoutMs }
  );

  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(result.stdout);
  } catch {
    parsedOutput = undefined;
  }

  return { ...result, parsedOutput };
}
