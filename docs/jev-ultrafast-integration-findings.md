# JEV Ultrafast integration findings

Date: 2026-10-09

## Verified implementation facts

- `JEV_BROWSER_BASE_URL` is not configured on the live `cidea-website-intelligence` Railway service.
- The current TypeScript adapter assumes a hosted HTTP API: `POST /execute` with `{ actions }`, returning `{ observations }`. No such endpoint has been verified.
- The upstream project is [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast). Its README documents a Python library (`from jev_ultrafast import Agent`), not a hosted `/execute` API.
- The upstream agent accepts a URL and a natural-language goal, then runs a bounded browser loop. It depends on Browser Harness and TypeSafe's hosted API. Typing into fields also requires an OpenAI-compatible text model key.
- Browser Harness supports local browser execution and Browser Use Cloud. The Cloud option is not automatically suitable for the current isolated preview: a cloud browser cannot reach the worker's `127.0.0.1:4173` preview without a separate secure exposure mechanism.
- The local-browser approach could keep the preview private by running the JEV agent in the same worker/container, provided that Python 3.12, Browser Harness, Chrome/Chromium, and required runtime libraries can be installed and launched on Railway.

## Required implementation change

Do not configure a guessed URL or preserve the assumed `POST /execute` contract.

The current interface is action-list oriented (`execute(actions)`), while upstream Jev is goal oriented (`Agent(url, goal)`). The integration needs an explicit adapter contract that:
1. receives the isolated preview URL and a bounded validation goal;
2. runs the real Jev Ultrafast agent against that URL in the same runtime as the preview;
3. collects actual executed-action history and an independently verified final state;
4. converts those records into the project's strict `BrowserObservation` schema;
5. fails closed when the browser runtime, TypeSafe credentials, text model, or final-state verification is unavailable.

## Before implementation is considered ready

- Confirm Railway can build the Python 3.12 + Chrome/Chromium runtime reproducibly without affecting the live site.
- Confirm the selected text model endpoint/key; do not assume the Hermes key is compatible without checking its configured API contract.
- Add offline adapter tests for success, blocked action, timeout, malformed output, and unavailable browser.
- Run one test against a local fixture through the real Jev agent, not against production.
- Keep the preview local; do not expose it publicly merely to make a separate browser service reach it.
- Keep production deployment and the staged PostgreSQL variable change under explicit human approval.


## Implementation decision (2026-10-09)

The production integration must use Jev's documented goal-based library contract, not emulate the unsupported hosted `/execute` API and not translate CSS selectors into Jev element IDs.

- Change the validation boundary to accept an explicit, bounded natural-language validation goal plus the isolated preview URL.
- Run Jev and Chromium in the same worker/container as the preview; bind the preview and DevTools endpoint to loopback only.
- Keep the Jev agent read-only in intent: inspect navigation, page rendering, visible primary content and obvious broken states. Do not submit forms, authenticate, purchase, or trigger external side effects.
- Record only actual entries from `agent.state["history"]`; a `DONE` state alone is not a pass.
- Independently open the preview and verify a successful HTTP response, expected origin, non-empty document title/body, and that the preview process remains alive.
- Map observed executed actions into the existing strict observation schema; reject empty history, invalid URLs, malformed snapshots, timeouts, missing credentials, and browser/runtime failures.
- Use an explicit execution timeout and always close the Jev-owned tab, Chromium process, and temporary profile in a `finally` path.
- The current `BrowserAction[]` interface is not a compatible input contract for Jev. It must be replaced at the validation boundary with a goal string, rather than silently reinterpreting `click`/selector instructions as Jev actions.

Implementation status (2026-10-09): the branch now contains a Python runner using the upstream `Agent(url, goal)` contract, a loopback-only Playwright Chromium launcher, a separate final-state check, strict loopback URL/credential gates, timeout handling, cleanup, and unit tests for missing credentials and non-loopback URLs. These changes are on the draft PR branch only. They are not production-deployed. CI status and the real local-fixture run still need verification; JEV must remain not-ready until those checks pass.
