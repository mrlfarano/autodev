import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeComposite, decideVerdict } from "../lib/composite.js";

describe("computeComposite", () => {
  it("computes weighted average of metric scores", () => {
    const weights = { bundle_size: 0.1, test_coverage: 0.2, type_errors: 0.1, judge_score: 0.6 };
    const metrics = { bundle_score: 100, coverage_score: 80, type_score: 100 };
    const judgeScore = 7.5; // normalized to 75
    const composite = computeComposite(weights, metrics, judgeScore);
    // 0.1*100 + 0.2*80 + 0.1*100 + 0.6*75 = 10 + 16 + 10 + 45 = 81.0
    assert.equal(composite, 81.0);
  });

  it("handles missing metrics gracefully", () => {
    const weights = { judge_score: 1.0 };
    const metrics = {};
    const composite = computeComposite(weights, metrics, 8.0);
    assert.equal(composite, 80.0);
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
