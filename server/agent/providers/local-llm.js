// server/agent/providers/local-llm.js — Local LLM inference provider (Ollama, LM Studio)

import { BaseProvider } from "./base.js";
import { parseResponse } from "./parse-response.js";

/**
 * Provider that calls a local inference server (Ollama, LM Studio)
 * via HTTP for completions.
 *
 * Config:
 *   endpoint — base URL, e.g. "http://localhost:11434" (required)
 *   model    — model name, e.g. "qwen3:4b" (required)
 *   timeout  — request timeout in ms (optional, defaults to 120000)
 */
export class LocalLlmProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    if (!config.endpoint) {
      throw new Error("LocalLlmProvider requires config.endpoint");
    }
    if (!config.model) {
      throw new Error("LocalLlmProvider requires config.model");
    }
    // Strip trailing slash for consistent URL construction
    this.endpoint = config.endpoint.replace(/\/+$/, "");
    this.model = config.model;
    this.timeout = config.timeout ?? 300_000; // 5 minutes for local models
  }

  /**
   * POST to {endpoint}/api/generate with the prompt and parse the response.
   * @param {string} prompt
   * @returns {Promise<{description: string, category: string, changes: Array}>}
   */
  async propose(prompt) {
    if (!prompt || typeof prompt !== "string") {
      throw new Error("prompt must be a non-empty string");
    }

    const url = `${this.endpoint}/api/generate`;
    const body = JSON.stringify({
      model: this.model,
      prompt,
      stream: false,
      // Note: don't use format:"json" — some models (qwen3.5) return empty responses with it
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `${this.endpoint} returned ${res.status}: ${text.slice(0, 200)}`
        );
      }

      const data = await res.json();
      const raw = data.response || "";

      const proposal = parseResponse(raw);
      if (!proposal) {
        throw new Error(
          `Failed to parse response from ${this.model}: ${raw.slice(0, 200)}`
        );
      }
      return proposal;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Verify connectivity by GETting {endpoint}/api/tags.
   * @returns {Promise<{ok: boolean, models?: string[], error?: string}>}
   */
  async test() {
    const url = `${this.endpoint}/api/tags`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) {
        return { ok: false, error: `Server returned ${res.status}` };
      }

      const data = await res.json();
      const models = Array.isArray(data.models)
        ? data.models.map((m) => m.name || m.model || String(m))
        : [];

      return { ok: true, models };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      clearTimeout(timer);
    }
  }
}
