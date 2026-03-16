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

  it("detects nextjs from next.config.mjs", () => {
    fs.writeFileSync(path.join(tmpDir, "next.config.mjs"), "");
    assert.equal(detectTemplate(tmpDir), "nextjs");
  });

  it("detects rust from Cargo.toml", () => {
    fs.writeFileSync(path.join(tmpDir, "Cargo.toml"), "");
    assert.equal(detectTemplate(tmpDir), "rust");
  });

  it("detects go from go.mod", () => {
    fs.writeFileSync(path.join(tmpDir, "go.mod"), "");
    assert.equal(detectTemplate(tmpDir), "go");
  });

  it("detects java-maven from pom.xml", () => {
    fs.writeFileSync(path.join(tmpDir, "pom.xml"), "");
    assert.equal(detectTemplate(tmpDir), "java-maven");
  });

  it("detects java-gradle from build.gradle", () => {
    fs.writeFileSync(path.join(tmpDir, "build.gradle"), "");
    assert.equal(detectTemplate(tmpDir), "java-gradle");
  });

  it("detects java-gradle from build.gradle.kts", () => {
    fs.writeFileSync(path.join(tmpDir, "build.gradle.kts"), "");
    assert.equal(detectTemplate(tmpDir), "java-gradle");
  });

  it("detects python from pyproject.toml", () => {
    fs.writeFileSync(path.join(tmpDir, "pyproject.toml"), "");
    assert.equal(detectTemplate(tmpDir), "python");
  });

  it("detects python from setup.py", () => {
    fs.writeFileSync(path.join(tmpDir, "setup.py"), "");
    assert.equal(detectTemplate(tmpDir), "python");
  });

  it("detects python from requirements.txt", () => {
    fs.writeFileSync(path.join(tmpDir, "requirements.txt"), "");
    assert.equal(detectTemplate(tmpDir), "python");
  });

  it("detects python from manage.py (Django)", () => {
    fs.writeFileSync(path.join(tmpDir, "manage.py"), "");
    assert.equal(detectTemplate(tmpDir), "python");
  });

  it("detects ruby from Gemfile", () => {
    fs.writeFileSync(path.join(tmpDir, "Gemfile"), "");
    assert.equal(detectTemplate(tmpDir), "ruby");
  });

  it("detects csharp from .csproj file", () => {
    fs.writeFileSync(path.join(tmpDir, "MyApp.csproj"), "");
    assert.equal(detectTemplate(tmpDir), "csharp");
  });

  it("detects typescript from tsconfig.json", () => {
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "");
    assert.equal(detectTemplate(tmpDir), "typescript");
  });

  it("detects typescript from package.json (when no other marker)", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
    assert.equal(detectTemplate(tmpDir), "typescript");
  });

  it("falls back to generic", () => {
    assert.equal(detectTemplate(tmpDir), "generic");
  });

  it("prefers more specific match (nextjs over typescript)", () => {
    fs.writeFileSync(path.join(tmpDir, "next.config.js"), "");
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "");
    fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
    assert.equal(detectTemplate(tmpDir), "nextjs");
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

  it("loads python template", () => {
    const tmpl = loadTemplate("python");
    assert.ok(tmpl.agentContext.includes("Python"));
  });

  it("loads rust template", () => {
    const tmpl = loadTemplate("rust");
    assert.ok(tmpl.agentContext.includes("Rust"));
  });

  it("loads go template", () => {
    const tmpl = loadTemplate("go");
    assert.ok(tmpl.agentContext.includes("Go"));
  });

  it("loads java-maven template", () => {
    const tmpl = loadTemplate("java-maven");
    assert.ok(tmpl.agentContext.includes("Maven"));
  });

  it("loads java-gradle template", () => {
    const tmpl = loadTemplate("java-gradle");
    assert.ok(tmpl.agentContext.includes("Gradle"));
  });

  it("loads csharp template", () => {
    const tmpl = loadTemplate("csharp");
    assert.ok(tmpl.agentContext.includes("C#"));
  });

  it("loads ruby template", () => {
    const tmpl = loadTemplate("ruby");
    assert.ok(tmpl.agentContext.includes("Ruby"));
  });

  it("loads typescript template", () => {
    const tmpl = loadTemplate("typescript");
    assert.ok(tmpl.agentContext.includes("TypeScript"));
  });
});

describe("parseTemplate structured metrics", () => {
  it("parses hard_gate list from nextjs template", () => {
    const tmpl = loadTemplate("nextjs");
    assert.ok(Array.isArray(tmpl.scoringOverrides.hard_gate));
    assert.ok(tmpl.scoringOverrides.hard_gate.length >= 3);
    assert.ok(tmpl.scoringOverrides.hard_gate.includes("npm run build"));
  });

  it("parses metrics definitions from nextjs template", () => {
    const tmpl = loadTemplate("nextjs");
    const metrics = tmpl.scoringOverrides.metrics;
    assert.ok(metrics);
    assert.ok(metrics.bundle_size);
    assert.equal(metrics.bundle_size.direction, "lower_is_better");
    assert.ok(metrics.bundle_size.command.includes("npm run build"));
    assert.ok(metrics.test_coverage);
    assert.equal(metrics.test_coverage.direction, "higher_is_better");
    assert.ok(metrics.type_errors);
    assert.equal(metrics.type_errors.parse, "stdout_as_number");
  });

  it("parses python template metrics", () => {
    const tmpl = loadTemplate("python");
    const metrics = tmpl.scoringOverrides.metrics;
    assert.ok(metrics.test_coverage);
    assert.ok(metrics.type_errors);
    assert.ok(metrics.code_quality);
    assert.equal(metrics.code_quality.parse_default, "0");
    assert.equal(metrics.code_quality.direction, "lower_is_better");
  });

  it("parses optional flag on rust metrics", () => {
    const tmpl = loadTemplate("rust");
    const metrics = tmpl.scoringOverrides.metrics;
    assert.equal(metrics.test_coverage.optional, true);
  });

  it("parses go template with stdout_as_number", () => {
    const tmpl = loadTemplate("go");
    const metrics = tmpl.scoringOverrides.metrics;
    assert.equal(metrics.test_coverage.parse, "stdout_as_number");
    assert.equal(metrics.vet_issues.parse, "stdout_as_number");
  });

  it("generic template has no metrics", () => {
    const tmpl = loadTemplate("generic");
    assert.equal(tmpl.scoringOverrides.metrics, undefined);
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
        metrics: { test_coverage: { command: "cmd", parse: "stdout_as_number", direction: "higher_is_better" } },
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
        metrics: { test_coverage: { command: "cmd", parse: "stdout_as_number", direction: "higher_is_better" } },
      },
    };
    const merged = mergeTemplateDefaults(config, template);
    assert.deepEqual(merged.scoring.hard_gate, ["npm run build", "npm run test"]);
  });

  it("merges template metrics into config", () => {
    const config = {
      scoring: {
        hard_gate: ["npm test"],
        metrics: {},
        weights: { judge_score: 1.0 },
        judge: { default: { small: "local" }, local: { endpoint: "http://localhost:11434", model: "qwen3:4b", timeout: 60 } },
      },
    };
    const template = {
      scoringOverrides: {
        metrics: {
          test_coverage: { command: "pytest --cov", parse: "stdout_as_number", direction: "higher_is_better" },
        },
      },
    };
    const merged = mergeTemplateDefaults(config, template);
    assert.ok(merged.scoring.templateMetrics);
    assert.ok(merged.scoring.templateMetrics.test_coverage);
    assert.equal(merged.scoring.templateMetrics.test_coverage.command, "pytest --cov");
  });
});
