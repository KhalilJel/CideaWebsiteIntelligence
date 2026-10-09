import json
import sys
from urllib.parse import urlparse

import jev_ultrafast.agent as agent_module
from jev_ultrafast import Agent


def deterministic_choice(page, goal, history):
    if history:
        return {
            "choice": "DONE",
            "probabilities": {"DONE": 1.0},
            "confidence": 1.0,
            "latency_ms": 0,
            "operation": "DONE",
            "target": "DONE",
            "usage": {},
        }

    candidates = page.get("actions", [])
    link = next(
        (action for action in candidates
         if str(action.get("kind", "")).lower() in {"click", "link"}),
        None,
    )
    if link is None:
        raise RuntimeError("Fixture page exposed no clickable link action.")
    selected = link["id"]
    return {
        "choice": selected,
        "probabilities": {selected: 1.0},
        "confidence": 1.0,
        "latency_ms": 0,
        "operation": "CLICK",
        "target": selected,
        "usage": {},
    }


def main() -> int:
    if len(sys.argv) != 2:
        print("Expected fixture URL.", file=sys.stderr)
        return 2
    url = sys.argv[1]
    parsed = urlparse(url)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost"}:
        print("Fixture URL must use loopback HTTP.", file=sys.stderr)
        return 2

    # Replace only the model decision function; Browser Harness, Chromium,
    # observation, target resolution, click execution and history stay real.
    agent_module.choose = deterministic_choice
    with Agent(url, "Open the fixture page's internal link and stop when the result heading is visible.") as agent:
        for _snapshot in agent.run():
            pass
        state = agent.state
        page = state.get("page") or {}
        result = {
            "status": state.get("status"),
            "historyCount": len(state.get("history", [])),
            "url": page.get("url"),
            "title": page.get("title"),
            "text": page.get("text", ""),
        }
        print(json.dumps(result))
        if state.get("status") != "done" or not state.get("history"):
            return 1
        if not str(page.get("url", "")).endswith("/next"):
            return 1
        if "Fixture loaded" not in str(page.get("text", "")):
            return 1
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
