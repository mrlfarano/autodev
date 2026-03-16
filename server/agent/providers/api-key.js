// server/agent/providers/api-key.js — Anthropic / OpenAI provider via API key

import Anthropic from "@anthropic-ai/sdk";
import { BaseProvider } from "./base.js";
import { parseResponse } from "./parse-response.js";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Provider that calls Anthropic or OpenAI using an API key.
 *
 * Config shape:
 *   { provider: 'anthropic' | 'openai', model: string, api_key: string }
 */
export class ApiKeyProvider extends BaseProvider {
  constructor(config) {
    super(config);

    if (!config.provider || !["anthropic", "openai"].includes(config.provider)) {
      throw new Error('ApiKeyProvider requires config.provider to be "anthropic" or "openai"');
    }
    // Allow env var fallback for API keys
    if (!config.api_key) {
      const envKey = config.provider === 'anthropic'
        ? process.env.ANTHROPIC_API_KEY
        : process.env.OPENAI_API_KEY;
      if (envKey) {
        config.api_key = envKey;
      } else {
        throw new Error("ApiKeyProvider requires config.api_key or ANTHROPIC_API_KEY/OPENAI_API_KEY env var");
      }
    }
    if (!config.model) {
      throw new Error("ApiKeyProvider requires config.model");
    }
  }

  /**
   * Send a prompt and return a parsed proposal.
   */
  async propose(prompt) {
    const raw =
      this.config.provider === "anthropic"
        ? await this._callAnthropic(prompt)
        : await this._callOpenAI(prompt);

    const proposal = parseResponse(raw);
    if (!proposal) {
      throw new Error("Failed to parse LLM response into a valid proposal");
    }
    return proposal;
  }

  /**
   * Verify credentials with a minimal API call.
   */
  async test() {
    try {
      if (this.config.provider === "anthropic") {
        await this._callAnthropic("Respond with the single word: ok");
      } else {
        await this._callOpenAI("Respond with the single word: ok");
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  async _callAnthropic(prompt) {
    const client = new Anthropic({ apiKey: this.config.api_key });

    const message = await client.messages.create({
      model: this.config.model,
      max_tokens: this.config.max_tokens || 4096,
      messages: [{ role: "user", content: prompt }],
    });

    // Extract text from content blocks
    const textBlocks = message.content.filter((b) => b.type === "text");
    return textBlocks.map((b) => b.text).join("");
  }

  async _callOpenAI(prompt) {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.api_key}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.max_tokens || 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${body}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
  }
}
