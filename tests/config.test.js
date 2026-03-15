import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadConfig } from "../lib/config.js";

describe("loadConfig", () => {
  let tmpDir;
  let configPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "autodev-test-"));
    configPath = path.join(tmpDir, "autodev.yaml");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads a valid config file", () => {
    fs.writeFileSync(configPath, `
target: /tmp/myproject
scoring:
  hard_gate:
    - npm test
  weights:
    bundle_size: 0.1
    test_coverage: 0.2
    type_errors: 0.1
    judge_score: 0.6
  judge:
    default:
      small: local
      medium: local
      large: cloud
    local:
      endpoint: http://localhost:11434
      model: qwen3:4b
      timeout: 60
    cloud:
      provider: anthropic
      model: claude-sonnet-4-6
      max_tokens: 1024
`);
    const config = loadConfig(configPath);
    assert.equal(config.target, "/tmp/myproject");
    assert.deepEqual(config.scoring.hard_gate, ["npm test"]);
  });

  it("expands ~ in target path", () => {
    fs.writeFileSync(configPath, `
target: ~/myproject
scoring:
  hard_gate:
    - npm test
  weights:
    bundle_size: 0.1
    test_coverage: 0.2
    type_errors: 0.1
    judge_score: 0.6
  judge:
    default:
      small: local
      medium: local
      large: cloud
    local:
      endpoint: http://localhost:11434
      model: qwen3:4b
      timeout: 60
    cloud:
      provider: anthropic
      model: claude-sonnet-4-6
      max_tokens: 1024
`);
    const config = loadConfig(configPath);
    assert.ok(!config.target.includes("~"));
    assert.ok(config.target.startsWith(os.homedir()));
  });

  it("throws if config file does not exist", () => {
    assert.throws(
      () => loadConfig("/nonexistent/autodev.yaml"),
      /not found/i
    );
  });

  it("throws if hard_gate is missing", () => {
    fs.writeFileSync(configPath, `
target: /tmp/myproject
scoring:
  weights:
    judge_score: 1.0
  judge:
    default:
      small: local
    local:
      endpoint: http://localhost:11434
      model: qwen3:4b
      timeout: 60
`);
    assert.throws(
      () => loadConfig(configPath),
      /hard_gate/i
    );
  });

  it("throws if weights do not sum to 1.0", () => {
    fs.writeFileSync(configPath, `
target: /tmp/myproject
scoring:
  hard_gate:
    - npm test
  weights:
    bundle_size: 0.5
    judge_score: 0.6
  judge:
    default:
      small: local
    local:
      endpoint: http://localhost:11434
      model: qwen3:4b
      timeout: 60
`);
    assert.throws(
      () => loadConfig(configPath),
      /weights.*sum.*1/i
    );
  });

  it("applies defaults for missing optional fields", () => {
    fs.writeFileSync(configPath, `
target: /tmp/myproject
scoring:
  hard_gate:
    - npm test
  weights:
    judge_score: 1.0
  judge:
    default:
      small: local
    local:
      endpoint: http://localhost:11434
      model: qwen3:4b
      timeout: 60
`);
    const config = loadConfig(configPath);
    assert.equal(config.branch_prefix, "autodev");
    assert.equal(config.budgets.small, 5);
    assert.equal(config.budgets.medium, 15);
    assert.equal(config.budgets.large, 30);
  });
});
