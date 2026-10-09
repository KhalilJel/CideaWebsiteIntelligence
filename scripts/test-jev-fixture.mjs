import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { guardBrowserNetwork } from "../src/integrations/jev-browser.ts";

let blockedRequests = 0;
const blockedServer = createServer((_request, response) => {
  blockedRequests += 1;
  response.end("This off-origin request should have been blocked.");
});

const server = createServer((request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  if (request.url === "/next") {
    response.end("<!doctype html><html><head><title>JEV Fixture Result</title></head><body><h1>Fixture loaded</h1></body></html>");
    return;
  }
  response.end("<!doctype html><html><head><title>JEV Fixture</title></head><body><h1>JEV fixture</h1><a href=\"/next\">Open result</a></body></html>");
});

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
let chromeProcess;
let profile;
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  await new Promise((resolve, reject) => {
    blockedServer.once("error", reject);
    blockedServer.listen(0, "127.0.0.1", resolve);
  });
  const blockedAddress = blockedServer.address();
  assert.ok(blockedAddress && typeof blockedAddress !== "string");
  const blockedUrl = `http://127.0.0.1:${blockedAddress.port}/must-not-be-requested`;
  assert.notEqual(new URL(url).origin, new URL(blockedUrl).origin);
  profile = await mkdtemp(join(tmpdir(), "jev-fixture-chrome-"));
  chromeProcess = spawn(chromium.executablePath(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    "--remote-debugging-address=127.0.0.1",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-features=ServiceWorker",
    "--disable-sync",
    "--disable-component-update",
    "--disable-default-apps",
    "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
    "about:blank"
  ], { shell: false, stdio: ["ignore", "ignore", "pipe"] });
  let chromeStderr = "";
  chromeProcess.stderr.on("data", chunk => { chromeStderr += chunk.toString(); });
  const cdpDeadline = Date.now() + 15_000;
  let cdpReady = false;
  let cdpPort;
  while (Date.now() < cdpDeadline) {
    if (chromeProcess.exitCode !== null) throw new Error(`Chromium exited early: ${chromeStderr.slice(-1500)}`);
    try {
      const activePort = await readFile(join(profile, "DevToolsActivePort"), "utf8");
      cdpPort = Number(activePort.split(/\r?\n/)[0]);
      if (!Number.isInteger(cdpPort) || cdpPort < 1 || cdpPort > 65535) throw new Error("Chromium published an invalid DevTools port.");
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        cdpReady = true;
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(cdpReady, `Chromium DevTools did not become ready: ${chromeStderr.slice(-1500)}`);
  assert.ok(cdpPort, "Chromium did not publish its DevTools port.");
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  await guardBrowserNetwork(browser, new URL(url).origin);
  const context = browser.contexts()[0];
  assert.ok(context, "Chromium did not expose its default context.");
  const probePage = await context.newPage();
  try {
    await probePage.goto(url);
    const requestOutcome = await probePage.evaluate(async target => {
      try {
        await fetch(target, { cache: "no-store" });
        return "allowed";
      } catch {
        return "blocked";
      }
    }, blockedUrl);
    assert.equal(requestOutcome, "blocked", "Off-origin browser fetch should be blocked.");
    assert.equal(blockedRequests, 0, "Blocked origin should not receive the request.");
  } finally {
    await probePage.close();
  }
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
  process.stdout.write("JEV local fixture passed: real Chromium/Browser Harness, internal click, final page, and off-origin HTTP blocking verified.\n");
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (chromeProcess && chromeProcess.exitCode === null && chromeProcess.signalCode === null) {
    chromeProcess.kill("SIGTERM");
    await new Promise(resolve => {
      const timer = setTimeout(() => { chromeProcess.kill("SIGKILL"); resolve(undefined); }, 3000);
      chromeProcess.once("close", () => { clearTimeout(timer); resolve(undefined); });
    });
  }
  if (profile) await rm(profile, { recursive: true, force: true });
  await new Promise(resolve => server.close(() => resolve(undefined)));
  await new Promise(resolve => blockedServer.close(() => resolve(undefined)));
}
