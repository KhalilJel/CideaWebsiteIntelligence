import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const server = createServer((request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  if (request.url === "/next") {
    response.end("<!doctype html><html><head><title>JEV Fixture Result</title></head><body><h1>Fixture loaded</h1></body></html>");
    return;
  }
  response.end("<!doctype html><html><head><title>JEV Fixture</title></head><body><h1>JEV fixture</h1><a href=\"/next\">Open result</a></body></html>");
});

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Could not reserve a DevTools port."));
        return;
      }
      const port = address.port;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function runFixtureRunner(url, env) {
  return new Promise((resolve, reject) => {
    const child = spawn("uv", ["run", "--project", process.env.JEV_PROJECT_DIR ?? "/opt/jev", "python", "scripts/jev_fixture_test_runner.py", url], {
      shell: false,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 3000).unref();
      reject(new Error("JEV fixture runner timed out after 60 seconds."));
    }, 60_000);
    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", code => {
      clearTimeout(timeout);
      const line = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
      if (code !== 0) {
        reject(new Error(`JEV fixture runner failed (exit ${code}): ${stderr.slice(-2000)} ${stdout.slice(-2000)}`));
        return;
      }
      try {
        resolve(JSON.parse(line ?? ""));
      } catch {
        reject(new Error(`JEV fixture runner returned invalid JSON: ${stdout.slice(-2000)}`));
      }
    });
  });
}

let browser;
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const cdpPort = await reservePort();
  browser = await chromium.launch({
    headless: true,
    args: [
      `--remote-debugging-port=${cdpPort}`,
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
  const result = await runFixtureRunner(url, {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: process.env.LANG,
    BU_CDP_URL: `http://127.0.0.1:${cdpPort}`
  });
  assert.equal(result.status, "done");
  assert.ok(result.historyCount >= 1);
  assert.ok(String(result.url).endsWith("/next"));
  assert.ok(String(result.text).includes("Fixture loaded"));
  process.stdout.write("JEV local fixture passed: real Chromium/Browser Harness, internal click, and final page verified.\n");
} finally {
  if (browser) await browser.close().catch(() => undefined);
  await new Promise(resolve => server.close(() => resolve(undefined)));
}
