import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeBundle, normalizeCoverage, normalizeTypeErrors } from "../lib/metrics.js";

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
