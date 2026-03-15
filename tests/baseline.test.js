import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readBaseline, writeBaseline } from "../lib/baseline.js";

describe("baseline", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "autodev-bl-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no baseline file exists", () => {
    assert.equal(readBaseline(tmpDir), null);
  });

  it("writes and reads baseline metrics", () => {
    const metrics = { bundle_kb: 287.9, test_coverage: 72.3, type_errors: 0 };
    writeBaseline(tmpDir, metrics);
    const loaded = readBaseline(tmpDir);
    assert.deepEqual(loaded, metrics);
  });

  it("overwrites existing baseline", () => {
    writeBaseline(tmpDir, { bundle_kb: 300 });
    writeBaseline(tmpDir, { bundle_kb: 250 });
    const loaded = readBaseline(tmpDir);
    assert.equal(loaded.bundle_kb, 250);
  });
});
