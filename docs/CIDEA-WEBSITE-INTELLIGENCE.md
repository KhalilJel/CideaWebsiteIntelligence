# Cidea Website Intelligence

## Purpose

Turn a public business website into evidence-backed improvement opportunities for Cidea.

## Architecture

Gullkornet → qualified lead → Cidea Website Intelligence → audit/research/improvement plan → Cidea sales.

## AI architecture

Hermes is the top-level orchestrator. Firecrawl is the website extraction layer. Agent Reach provides external context. JEV handles interactive browser execution. TypeSafe validates browser data at both input and output boundaries. Specialist agents reason over evidence.

### JEV runtime

The repository contains a safe HTTP adapter controlled by environment configuration:

- `JEV_BROWSER_BASE_URL` enables the adapter.
- `JEV_BROWSER_API_KEY` is optional for bearer authentication.
- The adapter is disabled when no base URL is configured.
- Requests time out after 30 seconds.
- JEV observations are never trusted directly. TypeSafe validates them before they enter the audit layer.
- Browser failures become explicit UX evidence and are passed into Hermes reasoning when the browser journey is enabled.

The exact JEV endpoint contract is intentionally kept behind the adapter. No vendor-specific runtime is assumed or activated until the actual JEV runtime is connected.

### Hermes browser flow

When a browser client and browser actions are supplied:

1. TypeSafe validates the requested browser actions.
2. JEV executes the journey.
3. TypeSafe validates the returned observations.
4. Failed or blocked interactions become evidence-backed UX findings.
5. Browser sources and signals are added to the research set.
6. Hermes reasons over the combined website, research and browser evidence.
7. The improvement plan remains review-only.

Without a configured JEV client or actions, the browser layer remains disabled.

## Safety

No automatic production deployment in the initial phase. Never change DNS or MX. No recommendation without evidence. Browser actions require explicit validated actions and observations.

## Targets

CideaLead focuses on conversion and lead generation.
CideaMarketing focuses on SEO, content and demand.
CideaConsulting focuses on authority and higher-value consulting opportunities.
