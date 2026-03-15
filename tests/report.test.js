import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { generateReportData } from "../reporting/generate.js";
import { HEADER } from "../lib/results.js";

describe("generateReportData", () => {
  let tmpDir;
  let tsvPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "autodev-rpt-"));
    tsvPath = path.join(tmpDir, "results.tsv");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("computes summary stats from results", () => {
    fs.writeFileSync(tsvPath, [
      HEADER,
      "a1b2c3d\t71.4\tPASS\t6.0\tbaseline\t-\tkeep\t2026-03-15T22:00:00Z\tbaseline",
      "b2c3d4e\t74.2\tPASS\t7.5\tquality\tsmall\tkeep\t2026-03-15T22:08:00Z\thook",
      "c3d4e5f\t73.0\tPASS\t5.0\tquality\tsmall\tdiscard\t2026-03-15T22:15:00Z\tstyles",
      "d4e5f6g\t0.0\tFAIL\t0.0\tfeature\tlarge\tcrash\t2026-03-15T22:48:00Z\tboom",
    ].join("\n"));

    const data = generateReportData(tsvPath);
    assert.equal(data.summary.total, 4);
    assert.equal(data.summary.kept, 2);
    assert.equal(data.summary.discarded, 1);
    assert.equal(data.summary.crashed, 1);
    assert.equal(data.summary.baselineScore, 71.4);
    assert.equal(data.summary.finalScore, 74.2);
  });

  it("identifies top improvements", () => {
    fs.writeFileSync(tsvPath, [
      HEADER,
      "a1b2c3d\t71.4\tPASS\t6.0\tbaseline\t-\tkeep\t2026-03-15T22:00:00Z\tbaseline",
      "b2c3d4e\t74.2\tPASS\t7.5\tquality\tsmall\tkeep\t2026-03-15T22:08:00Z\thook",
      "c3d4e5f\t79.0\tPASS\t8.0\tfeature\tmedium\tkeep\t2026-03-15T22:30:00Z\tchat",
    ].join("\n"));

    const data = generateReportData(tsvPath);
    assert.equal(data.topImprovements.length, 2);
    assert.equal(data.topImprovements[0].description, "chat"); // bigger delta first
  });

  it("identifies near-misses", () => {
    fs.writeFileSync(tsvPath, [
      HEADER,
      "a1b2c3d\t71.4\tPASS\t6.0\tbaseline\t-\tkeep\t2026-03-15T22:00:00Z\tbaseline",
      "b2c3d4e\t70.0\tPASS\t7.5\tquality\tsmall\tdiscard\t2026-03-15T22:08:00Z\tgood code bad metric",
    ].join("\n"));

    const data = generateReportData(tsvPath);
    assert.equal(data.nearMisses.length, 1);
    assert.equal(data.nearMisses[0].description, "good code bad metric");
  });
});
