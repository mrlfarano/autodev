import { execSync } from "node:child_process";
import { findOutput } from "./hard-gate.js";

export function normalizeBundle(currentKb, baselineKb) {
  if (baselineKb <= 0) return 100;
  const score = 100 - ((currentKb - baselineKb) / baselineKb) * 100;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

export function normalizeCoverage(pct) {
  return Math.max(0, Math.min(100, pct));
}

export function normalizeTypeErrors(count) {
  return Math.max(0, 100 - count * 20);
}

export async function collectMetrics(config, gateResult, baseline, cwd) {
  const metrics = {};
  const metricsConfig = config.scoring.metrics;

  if (metricsConfig.bundle_size) {
    const buildOutput = findOutput(gateResult, "build");
    metrics.bundle_kb = parseBundleSize(buildOutput?.stdout ?? "");
    metrics.bundle_score = normalizeBundle(
      metrics.bundle_kb,
      baseline?.bundle_kb ?? metrics.bundle_kb
    );
    metrics.bundle_delta = baseline
      ? +(metrics.bundle_kb - baseline.bundle_kb).toFixed(1)
      : 0;
  }

  if (metricsConfig.test_coverage) {
    metrics.test_coverage = await collectCoverage(cwd);
    metrics.coverage_score = normalizeCoverage(metrics.test_coverage);
    metrics.coverage_delta = baseline
      ? +(metrics.test_coverage - baseline.test_coverage).toFixed(1)
      : 0;
  }

  if (metricsConfig.type_errors) {
    metrics.type_errors = await collectTypeErrors(cwd);
    metrics.type_score = normalizeTypeErrors(metrics.type_errors);
    metrics.type_delta = baseline
      ? metrics.type_errors - baseline.type_errors
      : 0;
  }

  return metrics;
}

function parseBundleSize(buildOutput) {
  const match = buildOutput.match(
    /First Load JS shared by all\s+([\d.]+)\s*kB/
  );
  return match ? parseFloat(match[1]) : 0;
}

async function collectCoverage(cwd) {
  try {
    const output = execSync("npx vitest run --coverage --reporter=json 2>&1", {
      cwd,
      encoding: "utf-8",
      timeout: 120_000,
    });
    const jsonMatch = output.match(/"lines"\s*:\s*\{[^}]*"pct"\s*:\s*([\d.]+)/);
    return jsonMatch ? parseFloat(jsonMatch[1]) : 0;
  } catch {
    return 0;
  }
}

async function collectTypeErrors(cwd) {
  try {
    execSync("npx tsc --noEmit 2>&1", { cwd, encoding: "utf-8", timeout: 60_000 });
    return 0;
  } catch (err) {
    const output = err.stdout ?? "";
    const matches = output.match(/error TS/g);
    return matches ? matches.length : 0;
  }
}
