import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readResults, getPreviousScore, getBaseline, HEADER } from "../lib/results.js";

describe("results", () => {
  let tmpDir;
  let tsvPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "autodev-res-"));
    tsvPath = path.join(tmpDir, "results.tsv");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads empty results (header only)", () => {
    fs.writeFileSync(tsvPath, HEADER + "\n");
    const rows = readResults(tsvPath);
    assert.equal(rows.length, 0);
  });

  it("reads results with data rows", () => {
    fs.writeFileSync(tsvPath, [
      HEADER,
      "a1b2c3d\t71.4\tPASS\t6.0\tbaseline\t-\tkeep\t2026-03-15T22:00:00Z\tbaseline measurement",
      "b2c3d4e\t74.2\tPASS\t7.5\tquality\tsmall\tkeep\t2026-03-15T22:08:00Z\textract hook",
    ].join("\n"));
    const rows = readResults(tsvPath);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].composite, 74.2);
    assert.equal(rows[1].status, "keep");
  });

  it("getPreviousScore returns last kept composite", () => {
    fs.writeFileSync(tsvPath, [
      HEADER,
      "a1b2c3d\t71.4\tPASS\t6.0\tbaseline\t-\tkeep\t2026-03-15T22:00:00Z\tbaseline",
      "b2c3d4e\t74.2\tPASS\t7.5\tquality\tsmall\tkeep\t2026-03-15T22:08:00Z\thook",
      "c3d4e5f\t0.0\tFAIL\t0.0\tfeature\tlarge\tcrash\t2026-03-15T22:15:00Z\tboom",
    ].join("\n"));
    const prev = getPreviousScore(tsvPath);
    assert.equal(prev, 74.2);
  });

  it("getPreviousScore returns null when no results", () => {
    fs.writeFileSync(tsvPath, HEADER + "\n");
    assert.equal(getPreviousScore(tsvPath), null);
  });

  it("getBaseline returns first keep entry", () => {
    fs.writeFileSync(tsvPath, [
      HEADER,
      "a1b2c3d\t71.4\tPASS\t6.0\tbaseline\t-\tkeep\t2026-03-15T22:00:00Z\tbaseline",
    ].join("\n"));
    const base = getBaseline(tsvPath);
    assert.equal(base.composite, 71.4);
  });
});
