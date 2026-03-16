#!/usr/bin/env node
// bin/score.js — autodev-score CLI

import { parseArgs } from "node:util";
import { execSync } from "node:child_process";
import { loadConfig, resolveConfigPath } from "../lib/config.js";
import { detectTemplate, loadTemplate, mergeTemplateDefaults } from "../lib/template.js";
import { runHardGate } from "../lib/hard-gate.js";
import { collectMetrics } from "../lib/metrics.js";
import { readBaseline, writeBaseline } from "../lib/baseline.js";
import { runJudge, resolveJudgeConfig } from "../lib/judge.js";
import { computeComposite, decideVerdict } from "../lib/composite.js";
import { getPreviousScore, readResults } from "../lib/results.js";
import path from "node:path";
import fs from "node:fs";

const { values: args } = parseArgs({
  options: {
    "gate-only": { type: "boolean", default: false },
    "no-judge": { type: "boolean", default: false },
    size: { type: "string", default: "medium" },
    judge: { type: "string" },
    config: { type: "string" },
  },
  strict: false,
});

async function main() {
  // Load config
  const configPath = resolveConfigPath(args.config);
  let config = loadConfig(configPath);

  // Load and merge template
  const templateName = config.template || detectTemplate(config.target);
  const template = loadTemplate(templateName);
  config = mergeTemplateDefaults(config, template);

  const cwd = config.target;
  const tsvPath = path.join(cwd, "results.tsv");

  // Step 1: Hard Gate
  const gate = await runHardGate(config.scoring.hard_gate, cwd);

  if (!gate.passed) {
    console.log("---");
    console.log(`gate:             FAIL`);
    console.log(`gate_error:       ${gate.error}`);
    console.log(`build_seconds:    ${gate.buildSeconds.toFixed(1)}`);
    console.log(`verdict:          CRASH`);
    console.log("---");
    process.exit(1);
  }

  if (args["gate-only"]) {
    console.log("---");
    console.log(`gate:             PASS`);
    console.log(`build_seconds:    ${gate.buildSeconds.toFixed(1)}`);
    console.log("---");
    process.exit(0);
  }

  // Step 2: Metrics
  const baselineMetrics = readBaseline(cwd);
  const isBaseline = readResults(tsvPath).length === 0;

  const metrics = await collectMetrics(config, gate, baselineMetrics, cwd);

  // On first run, save baseline metrics for future comparison
  if (isBaseline) {
    const baselineData = {};
    // Save all raw metric values (keys without _score or _delta suffix)
    for (const [key, value] of Object.entries(metrics)) {
      if (!key.endsWith("_score") && !key.endsWith("_delta") && typeof value === "number") {
        baselineData[key] = value;
      }
    }
    writeBaseline(cwd, baselineData);
  }

  // Parse test result from gate output
  const testOutput = gate.outputs.find((o) => o.command.includes("test"));
  const testMatch = testOutput?.stdout?.match(/(\d+)\s+passed/);
  const testTotal = testOutput?.stdout?.match(/(\d+)\s+tests?/);
  const testResult = testMatch
    ? `${testMatch[1]}/${testTotal ? testTotal[1] : testMatch[1]} passed`
    : "unknown";

  // Parse lint result
  const lintOutput = gate.outputs.find((o) => o.command.includes("lint"));
  const lintMatch = lintOutput?.stdout?.match(/(\d+)\s+error/);
  const lintResult = lintMatch ? `${lintMatch[1]} errors` : "0 errors";

  // Step 3: Judge
  let judgeResult = { score: 0, summary: "skipped" };
  if (!args["no-judge"]) {
    const size = args.size || "medium";
    const judgeConfig = resolveJudgeConfig(config.scoring, size, args.judge);

    // Build delta object from all _delta keys
    const deltas = {};
    for (const [key, value] of Object.entries(metrics)) {
      if (key.endsWith("_delta")) {
        deltas[key] = value;
      }
    }

    if (isBaseline) {
      judgeResult = await runJudge(judgeConfig, "", metrics, { isBaseline: true });
    } else {
      // Diff from last KEPT commit
      let diff = "";
      let diffStat = "";
      const lastKeptCommit = readResults(tsvPath)
        .filter((r) => r.status === "keep")
        .pop()?.commit;
      try {
        const diffTarget = lastKeptCommit || "HEAD~1";
        diff = execSync(`git diff ${diffTarget} HEAD`, { cwd, encoding: "utf-8", timeout: 10_000 });
        diffStat = execSync(`git diff --stat ${diffTarget} HEAD`, { cwd, encoding: "utf-8", timeout: 10_000 });
      } catch {
        diff = "(diff unavailable)";
      }
      judgeResult = await runJudge(judgeConfig, diff, deltas);
    }
  }

  // Step 4: Composite + Verdict
  const composite = computeComposite(config.scoring.weights, metrics, judgeResult.score);
  const previousScore = getPreviousScore(tsvPath);
  const verdict = decideVerdict(composite, previousScore);

  // Output
  console.log("---");
  console.log(`gate:             PASS`);
  console.log(`build_seconds:    ${gate.buildSeconds.toFixed(1)}`);
  console.log(`test_result:      ${testResult}`);
  console.log(`lint_result:      ${lintResult}`);

  // Print all raw metric values and their deltas
  for (const [key, value] of Object.entries(metrics)) {
    if (key.endsWith("_score") || key.endsWith("_delta")) continue;
    // Skip legacy alias keys
    if (key === "bundle_kb") continue;
    const label = `${key}:`.padEnd(18);
    console.log(`${label}${value}`);
    const deltaKey = `${key}_delta`;
    if (metrics[deltaKey] !== undefined) {
      const deltaLabel = `${key}_delta:`.padEnd(18);
      const delta = metrics[deltaKey];
      console.log(`${deltaLabel}${delta >= 0 ? "+" : ""}${delta}`);
    }
  }

  console.log(`judge_score:      ${judgeResult.score.toFixed(1)}/10`);
  console.log(`judge_summary:    "${judgeResult.summary}"`);
  console.log(`composite_score:  ${composite}`);
  console.log(`previous_score:   ${previousScore ?? "none"}`);
  console.log(`verdict:          ${verdict}`);
  console.log("---");
}

main().catch((err) => {
  console.error(`autodev-score error: ${err.message}`);
  process.exit(2);
});
