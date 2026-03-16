import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeComposite, decideVerdict } from "../lib/composite.js";

describe("computeComposite", () => {
  it("computes weighted average of metric scores (legacy keys)", () => {
    const weights = { bundle_size: 0.1, test_coverage: 0.2, type_errors: 0.1, judge_score: 0.6 };
    const metrics = { bundle_score: 100, coverage_score: 80, type_score: 100 };
    const judgeScore = 7.5; // normalized to 75
    const composite = computeComposite(weights, metrics, judgeScore);
    // 0.1*100 + 0.2*80 + 0.1*100 + 0.6*75 = 10 + 16 + 10 + 45 = 81.0
    assert.equal(composite, 81.0);
  });

  it("computes weighted average using generic {key}_score pattern", () => {
    const weights = { test_coverage: 0.3, code_quality: 0.2, judge_score: 0.5 };
    const metrics = { test_coverage_score: 85, code_quality_score: 100 };
    const judgeScore = 8.0; // normalized to 80
    const composite = computeComposite(weights, metrics, judgeScore);
    // 0.3*85 + 0.2*100 + 0.5*80 = 25.5 + 20 + 40 = 85.5
    assert.equal(composite, 85.5);
  });

  it("prefers generic key over legacy key", () => {
    const weights = { bundle_size: 0.5, judge_score: 0.5 };
    // Both generic and legacy keys present — generic should win
    const metrics = { bundle_size_score: 90, bundle_score: 50 };
    const judgeScore = 8.0;
    const composite = computeComposite(weights, metrics, judgeScore);
    // 0.5*90 + 0.5*80 = 45 + 40 = 85.0
    assert.equal(composite, 85.0);
  });

  it("falls back to legacy key when generic not present", () => {
    const weights = { bundle_size: 0.5, judge_score: 0.5 };
    const metrics = { bundle_score: 70 };
    const judgeScore = 8.0;
    const composite = computeComposite(weights, metrics, judgeScore);
    // 0.5*70 + 0.5*80 = 35 + 40 = 75.0
    assert.equal(composite, 75.0);
  });

  it("handles missing metrics gracefully", () => {
    const weights = { judge_score: 1.0 };
    const metrics = {};
    const composite = computeComposite(weights, metrics, 8.0);
    assert.equal(composite, 80.0);
  });

  it("handles language-specific metric keys", () => {
    const weights = { compiler_warnings: 0.2, clippy_warnings: 0.3, judge_score: 0.5 };
    const metrics = { compiler_warnings_score: 100, clippy_warnings_score: 80 };
    const judgeScore = 7.0;
    const composite = computeComposite(weights, metrics, judgeScore);
    // 0.2*100 + 0.3*80 + 0.5*70 = 20 + 24 + 35 = 79.0
    assert.equal(composite, 79.0);
  });
});

describe("decideVerdict", () => {
  it("returns KEEP when composite >= previous", () => {
    assert.equal(decideVerdict(82.3, 80.1), "KEEP");
  });

  it("returns KEEP when equal", () => {
    assert.equal(decideVerdict(80.0, 80.0), "KEEP");
  });

  it("returns DISCARD when composite < previous", () => {
    assert.equal(decideVerdict(79.9, 80.0), "DISCARD");
  });

  it("returns KEEP when no previous score (first experiment)", () => {
    assert.equal(decideVerdict(82.3, null), "KEEP");
  });
});
