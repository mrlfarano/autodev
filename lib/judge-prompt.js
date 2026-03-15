export const DIFF_TOKEN_CAP = 8000;

const RUBRIC = `You are a code review judge. Score the following code change on four dimensions (0-10 each):

- **Correctness**: Does the change do what it intends? Any obvious bugs introduced?
- **Quality**: Is the code clean, idiomatic, well-structured?
- **Impact**: How meaningful is this change? Trivial formatting = low. New feature = high.
- **Risk** (inverted): Low risk = high score. Breaking APIs, removing functionality, or adding complexity = low.

Respond with ONLY a JSON object:
{"correctness": N, "quality": N, "impact": N, "risk": N, "summary": "one line"}`;

export function buildJudgePrompt(diff, metricDeltas, diffStat) {
  let truncated = false;
  let diffContent = diff;
  if (diff.length > DIFF_TOKEN_CAP * 4) {
    diffContent = diff.slice(0, DIFF_TOKEN_CAP * 4);
    truncated = true;
  }

  let prompt = RUBRIC + "\n\n";
  prompt += "## Metric Deltas\n";
  for (const [key, value] of Object.entries(metricDeltas)) {
    if (value !== undefined) prompt += `- ${key}: ${value > 0 ? "+" : ""}${value}\n`;
  }
  if (truncated && diffStat) {
    prompt += "\n## Diff Stats (full overview)\n```\n" + diffStat + "\n```\n";
    prompt += "\nNOTE: The full diff was TRUNCATED due to length. Stats above show the complete scope.\n";
  }
  prompt += "\n## Diff\n```\n" + diffContent + "\n```";
  return prompt;
}

export function buildBaselinePrompt(metrics) {
  return `${RUBRIC}

This is a baseline evaluation of the codebase in its current state (no diff — first run).

## Current Metrics
- Test coverage: ${metrics.test_coverage ?? "unknown"}%
- Type errors: ${metrics.type_errors ?? "unknown"}
- Bundle size: ${metrics.bundle_kb ?? "unknown"} kB

Score the codebase holistically. This baseline score sets the bar for future experiments.`;
}

export function parseJudgeResponse(raw) {
  let jsonStr = raw;
  const jsonMatch = raw.match(/\{[\s\S]*?"summary"[\s\S]*?\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const clamp = (v) => Math.max(0, Math.min(10, Number(v) || 0));
    const correctness = clamp(parsed.correctness);
    const quality = clamp(parsed.quality);
    const impact = clamp(parsed.impact);
    const risk = clamp(parsed.risk);
    const score = (correctness + quality + impact + risk) / 4;
    return {
      correctness, quality, impact, risk,
      score: Math.round(score * 100) / 100,
      summary: String(parsed.summary || "").slice(0, 200),
    };
  } catch {
    return null;
  }
}
