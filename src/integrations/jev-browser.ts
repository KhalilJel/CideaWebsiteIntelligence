import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium, type Browser } from "playwright";

export type BrowserAction={type:"click"|"type"|"scroll"|"navigate"|"wait";target?:string;value?:string};
export type BrowserObservation={url:string;action:BrowserAction;result:"success"|"blocked"|"failed";observation:string;screenshotUrl?:string;collectedAt:string};
export type JEVBrowserClient={execute(actions:BrowserAction[]):Promise<BrowserObservation[]>};

type JEVRunnerOutput = {
  status?: string;
  history?: Array<Record<string, unknown>>;
  page?: { url?: string; title?: string; text?: string };
  error?: string;
};

const VALIDATION_GOAL = [
  "Read-only QA of this isolated website preview.",
  "Inspect the rendered page, navigation, visible primary content, and obvious broken or blocked states.",
  "Do not submit forms, sign in, purchase, send messages, or trigger any external side effects.",
  "Stop when you have inspected the page and can report whether the preview rendered coherently."
].join(" ");

function reserveLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve a loopback DevTools port."));
        return;
      }
      const port = address.port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function runJEV(url: string, goal: string, env: NodeJS.ProcessEnv, timeoutMs = 90_000): Promise<JEVRunnerOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn("uv", ["run", "--project", process.env.JEV_PROJECT_DIR ?? "/opt/jev", "python", "/app/scripts/jev_local_runner.py", url, goal], {
      shell: false,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      if (!settled) {
        settled = true;
        reject(new Error(`JEV timed out after ${timeoutMs}ms.`));
      }
    }, timeoutMs);
    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.once("error", error => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.once("close", code => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      let payload: JEVRunnerOutput;
      try {
        payload = JSON.parse(lines[lines.length - 1] ?? "") as JEVRunnerOutput;
      } catch {
        reject(new Error(`JEV runner returned malformed output (exit ${code}): ${(stderr || stdout).slice(-1500)}`));
        return;
      }
      if (payload.error) {
        reject(new Error(`JEV runner failed: ${payload.error}`));
        return;
      }
      if (code !== 0 && payload.status !== "blocked") {
        reject(new Error(`JEV runner exited with code ${code}: ${(stderr || stdout).slice(-1500)}`));
        return;
      }
      resolve(payload);
    });
  });
}

function mapHistory(history: Array<Record<string, unknown>>, fallbackUrl: string, status: string): BrowserObservation[] {
  return history.map((entry, index) => {
    const kind = String(entry.kind ?? "").toLowerCase();
    const actionType: BrowserAction["type"] =
      kind === "fill" || kind === "type_text" ? "type" :
      kind === "scroll" || kind === "scroll_up" || kind === "scroll_down" ? "scroll" :
      kind === "wait" ? "wait" : "click";
    const url = typeof entry.url === "string" ? entry.url : fallbackUrl;
    const action: BrowserAction = {
      type: actionType,
      ...(typeof entry.target === "string" ? { target: entry.target } : {}),
      ...(typeof entry.text === "string" ? { value: entry.text } : {})
    };
    return {
      url,
      action,
      result: status === "blocked" ? "blocked" : "success",
      observation: `JEV executed step ${index + 1}: ${String(entry.action ?? entry.kind ?? "browser action")}. Page changed: ${String(entry.page_changed ?? "unknown")}.`,
      collectedAt: new Date().toISOString()
    };
  });
}

export function createJEVBrowserClient(previewUrl?: string): JEVBrowserClient | undefined {
  const typesafeKey = process.env.TYPESAFE_API_KEY?.trim();
  const textModelKey = process.env.TEXT_MODEL_API_KEY?.trim();
  if (!previewUrl || !typesafeKey || !textModelKey) return undefined;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(previewUrl);
  } catch {
    return undefined;
  }
  if (parsedUrl.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsedUrl.hostname)) return undefined;

  return {
    async execute(actions) {
      if (!actions.length) throw new Error("JEV validation requires at least one requested validation action.");
      const port = await reserveLoopbackPort();
      let browser: Browser | undefined;
      try {
        browser = await chromium.launch({
          headless: true,
          args: [
            `--remote-debugging-port=${port}`,
            "--remote-debugging-address=127.0.0.1",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--disable-sync",
            "--disable-component-update",
            "--disable-default-apps",
            "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"
          ]
        });
        const env: NodeJS.ProcessEnv = {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          LANG: process.env.LANG,
          TYPESAFE_API_KEY: typesafeKey,
          TEXT_MODEL_API_KEY: textModelKey,
          TEXT_MODEL_BASE_URL: process.env.TEXT_MODEL_BASE_URL ?? "https://openrouter.ai/api/v1",
          TEXT_MODEL: process.env.TEXT_MODEL ?? "inception/mercury-2.5",
          TEXT_MODEL_REASONING: process.env.TEXT_MODEL_REASONING ?? "none",
          BU_CDP_URL: `http://127.0.0.1:${port}`
        };
        const output = await runJEV(previewUrl, VALIDATION_GOAL, env);
        const history = output.history ?? [];
        if (!history.length) throw new Error("JEV produced no executed-action history; validation fails closed.");
        if (output.status !== "done") throw new Error(`JEV did not finish successfully (status: ${output.status ?? "unknown"}).`);
        for (const entry of history) {
          if (typeof entry.url === "string" && new URL(entry.url).origin !== parsedUrl.origin) {
            throw new Error("JEV left the isolated preview origin; validation fails closed.");
          }
        }

        // Independent final-state check: open the isolated preview in a separate tab.
        const page = await browser.newPage();
        try {
          const response = await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
          const finalUrl = page.url();
          const title = (await page.title()).trim();
          const bodyText = ((await page.locator("body").innerText({ timeout: 5000 }).catch(() => ""))).trim();
          if (!response || response.status() < 200 || response.status() >= 400) {
            throw new Error(`Independent preview check failed with HTTP ${response?.status() ?? "no response"}.`);
          }
          if (new URL(finalUrl).origin !== parsedUrl.origin) throw new Error("Independent preview check navigated away from the isolated preview origin.");
          if (!title || !bodyText) throw new Error("Independent preview check found an empty title or body.");
          const observations = mapHistory(history, previewUrl, output.status);
          observations.push({
            url: finalUrl,
            action: { type: "navigate", target: previewUrl },
            result: "success",
            observation: `Independent final-state check passed: HTTP ${response.status()}, title "${title}", ${bodyText.length} visible body characters.`,
            collectedAt: new Date().toISOString()
          });
          return observations;
        } finally {
          await page.close();
        }
      } finally {
        if (browser) await browser.close().catch(() => undefined);
      }
    }
  };
}
