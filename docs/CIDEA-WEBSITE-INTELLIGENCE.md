# Cidea Website Intelligence

## Purpose

Turn a public business website into evidence-backed improvement opportunities for Cidea.

## Architecture

Gullkornet → qualified lead → Cidea Website Intelligence → audit/research/improvement plan → Cidea sales.

## AI architecture

Hermes is the top-level orchestrator. Firecrawl is the website extraction layer. Agent Reach provides external context. JEV handles interactive browser execution. TypeSafe validates browser data at both input and output boundaries. Specialist agents reason over evidence.

### Firecrawl

- FIRECRAWL_API_KEY enables the Firecrawl adapter.
- FIRECRAWL_BASE_URL is optional and defaults to Firecrawl's API base.
- The adapter is disabled when no API key is configured.
- Requests time out after 20 seconds.

### Agent Reach

Agent Reach is treated as a capability/CLI layer rather than a vendor-specific HTTP API.

- AGENT_REACH_ENABLED=true enables the adapter.
- AGENT_REACH_BIN optionally selects the executable path and defaults to agent-reach.
- The adapter invokes the CLI without a shell and enforces a 30 second timeout.
- Search results are converted into typed evidence before entering research.
- If Agent Reach is unavailable or fails, Hermes does not invent external evidence. The failure remains an unresolved research question.

### JEV runtime

The repository contains a safe HTTP adapter controlled by environment configuration:

- JEV_BROWSER_BASE_URL enables the adapter.
- JEV_BROWSER_API_KEY is optional for bearer authentication.
- The adapter is disabled when no base URL is configured.
- Requests time out after 30 seconds.
- JEV observations are never trusted directly. TypeSafe validates them before they enter the audit layer.
- Browser failures become explicit UX evidence and are passed into Hermes reasoning when the browser journey is enabled.

The exact JEV endpoint contract is intentionally kept behind the adapter. No vendor-specific runtime is assumed or activated until the actual JEV runtime is connected.

### Hermes research flow

1. Firecrawl extracts the target website when configured.
2. JEV can execute explicit interactive journeys when configured.
3. TypeSafe validates browser actions and observations.
4. Agent Reach can add public external context.
5. Hermes reasons over the combined evidence.
6. The Improvement Director produces a review-only plan.

No external source is treated as fact without a source URL and collected evidence.

## Safety

No automatic production deployment in the initial phase. Never change DNS or MX. No recommendation without evidence. Browser actions require explicit validated actions and observations.

## Targets

CideaLead focuses on conversion and lead generation.
CideaMarketing focuses on SEO, content and demand.
CideaConsulting focuses on authority and higher-value consulting opportunities.

## Imagine → Decide

Improvement actions now carry a small, validated design-decision contract.

1. Evidence-backed problem and business objective are recorded.
2. Two or more concrete alternatives are generated.
3. Alternatives are evaluated against conversion, brand fit, UX, hierarchy, differentiation and complexity.
4. One alternative is selected and rejected alternatives are recorded.
5. The chosen direction becomes the implementation proposal.
6. Human approval remains required before implementation.

This is intentionally a lightweight contract, not a design knowledge base. Repeated real-world outcomes can later be used to add a knowledge layer without changing the core pipeline.
