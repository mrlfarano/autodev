import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

describe("autodev-score integration", () => {
  let tmpDir;
  let configPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "autodev-int-"));
    // Create a minimal "target project"
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      scripts: {
        build: "echo build ok",
        test: "echo 5 tests passed",
        lint: "echo 0 errors",
      },
    }));
    // Create config pointing at it
    configPath = path.join(tmpDir, "autodev.yaml");
    fs.writeFileSync(configPath, `
target: ${tmpDir.replace(/\\/g, "/")}
scoring:
  hard_gate:
    - node -e "console.log('build ok')"
    - node -e "console.log('5 tests passed')"
  metrics:
    bundle_size: false
    test_coverage: false
    type_errors: false
  weights:
    judge_score: 1.0
  judge:
    default:
      small: local
      medium: local
      large: local
    local:
      endpoint: http://localhost:11434
      model: qwen3:4b
      timeout: 5
`);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("runs --gate-only and outputs PASS", () => {
    const binPath = path.resolve("bin/score.js").replace(/\\/g, "/");
    const cfgPath = configPath.replace(/\\/g, "/");
    const output = execSync(`node "${binPath}" --gate-only --config "${cfgPath}"`, {
      encoding: "utf-8",
    });
    assert.ok(output.includes("gate:"));
    assert.ok(output.includes("PASS"));
  });

  it("runs --gate-only with failing command and outputs FAIL", () => {
    // Overwrite config with a failing gate command
    fs.writeFileSync(configPath, `
target: ${tmpDir.replace(/\\/g, "/")}
scoring:
  hard_gate:
    - node -e "process.exit(1)"
  metrics:
    bundle_size: false
    test_coverage: false
    type_errors: false
  weights:
    judge_score: 1.0
  judge:
    default:
      small: local
    local:
      endpoint: http://localhost:11434
      model: qwen3:4b
      timeout: 5
`);
    const binPath = path.resolve("bin/score.js").replace(/\\/g, "/");
    const cfgPath = configPath.replace(/\\/g, "/");
    try {
      execSync(`node "${binPath}" --gate-only --config "${cfgPath}"`, {
        encoding: "utf-8",
      });
      assert.fail("Should have exited with non-zero");
    } catch (err) {
      assert.ok(err.stdout.includes("FAIL") || err.stderr.includes("FAIL"));
    }
  });
});
