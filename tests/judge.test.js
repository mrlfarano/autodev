import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildJudgePrompt, buildBaselinePrompt, parseJudgeResponse, DIFF_TOKEN_CAP } from "../lib/judge-prompt.js";

describe("buildJudgePrompt", () => {
  it("includes the diff and metrics in the prompt", () => {
    const prompt = buildJudgePrompt("diff --git a/foo.js...", { bundle_delta: -3.2, coverage_delta: 1.2, type_delta: 0 });
    assert.ok(prompt.includes("diff --git"));
    assert.ok(prompt.includes("-3.2"));
    assert.ok(prompt.includes("Correctness"));
    assert.ok(prompt.includes("Quality"));
    assert.ok(prompt.includes("Impact"));
    assert.ok(prompt.includes("Risk"));
  });

  it("truncates long diffs and adds notice", () => {
    const longDiff = "x".repeat(DIFF_TOKEN_CAP * 5);
    const prompt = buildJudgePrompt(longDiff, {}, "10 files changed");
    assert.ok(prompt.includes("TRUNCATED"));
    assert.ok(prompt.includes("10 files changed"));
    assert.ok(prompt.length < longDiff.length);
  });
});

describe("buildBaselinePrompt", () => {
  it("asks for holistic codebase review", () => {
    const prompt = buildBaselinePrompt({ test_coverage: 72, type_errors: 0, bundle_kb: 288 });
    assert.ok(prompt.includes("baseline"));
  });
});

describe("parseJudgeResponse", () => {
  it("parses valid JSON response", () => {
    const raw = '{"correctness": 8, "quality": 7, "impact": 9, "risk": 7, "summary": "Good stuff"}';
    const result = parseJudgeResponse(raw);
    assert.equal(result.score, 7.75);
    assert.equal(result.summary, "Good stuff");
  });

  it("extracts JSON from surrounding text", () => {
    const raw = 'Here is my review:\n```json\n{"correctness": 6, "quality": 6, "impact": 6, "risk": 6, "summary": "OK"}\n```';
    const result = parseJudgeResponse(raw);
    assert.equal(result.score, 6.0);
  });

  it("returns null for unparseable response", () => {
    const result = parseJudgeResponse("I cannot evaluate this code properly.");
    assert.equal(result, null);
  });

  it("clamps scores to 0-10 range", () => {
    const raw = '{"correctness": 15, "quality": -2, "impact": 8, "risk": 8, "summary": "Weird"}';
    const result = parseJudgeResponse(raw);
    assert.ok(result.score <= 10);
    assert.ok(result.score >= 0);
  });
});
