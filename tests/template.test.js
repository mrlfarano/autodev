import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { detectTemplate, loadTemplate, mergeTemplateDefaults } from "../lib/template.js";

describe("detectTemplate", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "autodev-tmpl-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects nextjs from next.config.ts", () => {
    fs.writeFileSync(path.join(tmpDir, "next.config.ts"), "");
    assert.equal(detectTemplate(tmpDir), "nextjs");
  });

  it("detects nextjs from next.config.js", () => {
    fs.writeFileSync(path.join(tmpDir, "next.config.js"), "");
    assert.equal(detectTemplate(tmpDir), "nextjs");
  });

  it("falls back to generic", () => {
    assert.equal(detectTemplate(tmpDir), "generic");
  });
});

describe("loadTemplate", () => {
  it("loads nextjs template and parses agent context", () => {
    const tmpl = loadTemplate("nextjs");
    assert.ok(tmpl.agentContext.includes("Next.js"));
  });

  it("loads generic template", () => {
    const tmpl = loadTemplate("generic");
    assert.ok(tmpl.agentContext.includes("Generic"));
  });
});

describe("mergeTemplateDefaults", () => {
  it("config values override template defaults", () => {
    const config = {
      scoring: {
        hard_gate: ["make test"],
        metrics: {},
        weights: { judge_score: 1.0 },
        judge: { default: { small: "local" }, local: { endpoint: "http://localhost:11434", model: "qwen3:4b", timeout: 60 } },
      },
    };
    const template = {
      scoringOverrides: {
        hard_gate: ["npm run build", "npm run test"],
      },
    };
    const merged = mergeTemplateDefaults(config, template);
    assert.deepEqual(merged.scoring.hard_gate, ["make test"]);
  });

  it("template provides defaults when config omits them", () => {
    const config = {
      scoring: {
        hard_gate: undefined,
        metrics: {},
        weights: { judge_score: 1.0 },
        judge: { default: { small: "local" }, local: { endpoint: "http://localhost:11434", model: "qwen3:4b", timeout: 60 } },
      },
    };
    const template = {
      scoringOverrides: {
        hard_gate: ["npm run build", "npm run test"],
      },
    };
    const merged = mergeTemplateDefaults(config, template);
    assert.deepEqual(merged.scoring.hard_gate, ["npm run build", "npm run test"]);
  });
});
