import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeBundle, normalizeCoverage, normalizeTypeErrors, normalizeMetric } from "../lib/metrics.js";

describe("normalizeBundle", () => {
  it("returns 100 when current equals baseline", () => {
    assert.equal(normalizeBundle(300, 300), 100);
  });

  it("returns less than 100 when bundle increased", () => {
    const score = normalizeBundle(330, 300); // 10% increase
    assert.equal(score, 90);
  });

  it("caps at 100 when bundle decreased", () => {
    const score = normalizeBundle(250, 300);
    assert.equal(score, 100);
  });

  it("returns 0 when bundle doubled", () => {
    const score = normalizeBundle(600, 300);
    assert.equal(score, 0);
  });
});

describe("normalizeCoverage", () => {
  it("returns the raw percentage", () => {
    assert.equal(normalizeCoverage(78.4), 78.4);
  });
});

describe("normalizeTypeErrors", () => {
  it("returns 100 for 0 errors", () => {
    assert.equal(normalizeTypeErrors(0), 100);
  });

  it("returns 80 for 1 error", () => {
    assert.equal(normalizeTypeErrors(1), 80);
  });

  it("returns 0 for 5+ errors", () => {
    assert.equal(normalizeTypeErrors(5), 0);
    assert.equal(normalizeTypeErrors(100), 0);
  });
});

describe("normalizeMetric", () => {
  it("higher_is_better: uses value as score capped at 100", () => {
    assert.equal(normalizeMetric(85, "higher_is_better", null), 85);
    assert.equal(normalizeMetric(150, "higher_is_better", null), 100);
    assert.equal(normalizeMetric(-5, "higher_is_better", null), 0);
  });

  it("lower_is_better without baseline: 100 - count * 20", () => {
    assert.equal(normalizeMetric(0, "lower_is_better", null), 100);
    assert.equal(normalizeMetric(1, "lower_is_better", null), 80);
    assert.equal(normalizeMetric(5, "lower_is_better", null), 0);
    assert.equal(normalizeMetric(10, "lower_is_better", null), 0);
  });

  it("lower_is_better with baseline: compares to baseline", () => {
    // Same as baseline → 100
    assert.equal(normalizeMetric(300, "lower_is_better", 300), 100);
    // 10% increase → 90
    assert.equal(normalizeMetric(330, "lower_is_better", 300), 90);
    // Doubled → 0
    assert.equal(normalizeMetric(600, "lower_is_better", 300), 0);
  });

  it("returns 0 for unknown direction", () => {
    assert.equal(normalizeMetric(50, "unknown", null), 0);
  });
});
