export type HermesLLMRequest = { system: string; user: string };
export type HermesLLMClient = { complete(request: HermesLLMRequest): Promise<string> };

export function createHermesLLMClient(): HermesLLMClient | undefined {
  const apiKey = process.env.HERMES_LLM_API_KEY;
  const baseUrl = process.env.HERMES_LLM_BASE_URL;
  const model = process.env.HERMES_LLM_MODEL;
  if (!apiKey || !baseUrl || !model) return undefined;

  return {
    async complete(request) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetch(baseUrl.replace(/\\/$/, ""), {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            temperature: 0,
            messages: [
              { role: "system", content: request.system },
              { role: "user", content: request.user }
            ]
          }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Hermes LLM returned HTTP ${response.status}`);
        const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
        const content = payload.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) throw new Error("Hermes LLM returned no text");
        return content;
      } finally { clearTimeout(timeout); }
    }
  };
}
