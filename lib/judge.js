import http from "node:http";
import { buildJudgePrompt, buildBaselinePrompt, parseJudgeResponse } from "./judge-prompt.js";

const MAX_RETRIES = 2;
const DEFAULT_SCORE = { score: 5.0, summary: "Judge parse failure — score defaulted.", correctness: 5, quality: 5, impact: 5, risk: 5 };

export async function runJudge(config, diff, metricDeltas, { isBaseline = false } = {}) {
  const prompt = isBaseline
    ? buildBaselinePrompt(metricDeltas)
    : buildJudgePrompt(diff, metricDeltas);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await callProvider(config, prompt);
      const result = parseJudgeResponse(raw);
      if (result) return result;
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        console.error(`Judge error after ${MAX_RETRIES + 1} attempts: ${err.message}`);
        return DEFAULT_SCORE;
      }
    }
  }
  return DEFAULT_SCORE;
}

async function callProvider(judgeConfig, prompt) {
  if (judgeConfig._provider === "local") {
    return callOllama(judgeConfig, prompt);
  } else {
    return callAnthropic(judgeConfig, prompt);
  }
}

async function callOllama(config, prompt) {
  const url = new URL("/api/generate", config.endpoint);
  const body = JSON.stringify({
    model: config.model,
    prompt,
    stream: false,
    format: "json",
  });

  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      timeout: (config.timeout || 60) * 1000,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.response || data);
        } catch {
          resolve(data);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Ollama request timed out")); });
    req.write(body);
    req.end();
  });
}

async function callAnthropic(config, prompt) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const response = await client.messages.create({
    model: config.model || "claude-sonnet-4-6",
    max_tokens: config.max_tokens || 1024,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content[0].text;
}

export function resolveJudgeConfig(scoringConfig, size, judgeOverride) {
  const providerName = judgeOverride || scoringConfig.judge.default[size] || "local";
  const providerConfig = scoringConfig.judge[providerName];
  return { ...providerConfig, _provider: providerName };
}
