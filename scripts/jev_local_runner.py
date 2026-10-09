import json
import sys
import traceback
from urllib.parse import urlparse

from jev_ultrafast import Agent


def main() -> int:
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Expected preview URL and validation goal."}))
        return 2

    url, goal = sys.argv[1], sys.argv[2]
    parsed = urlparse(url)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost"}:
        print(json.dumps({"error": "JEV runner only accepts an HTTP loopback preview URL."}))
        return 2
    if not goal.strip() or len(goal) > 2000:
        print(json.dumps({"error": "Validation goal is empty or too long."}))
        return 2

    try:
        with Agent(url, goal) as agent:
            for _snapshot in agent.run():
                pass
            state = agent.state
            print(json.dumps({
                "status": state.get("status"),
                "history": state.get("history", []),
                "page": {
                    "url": (state.get("page") or {}).get("url"),
                    "title": (state.get("page") or {}).get("title"),
                    "text": (state.get("page") or {}).get("text", "")[:6000],
                },
                "elapsedMs": state.get("elapsed_ms"),
            }))
            return 0 if state.get("status") == "done" else 1
    except Exception as exc:
        print(json.dumps({"error": str(exc), "trace": traceback.format_exc(limit=2)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
