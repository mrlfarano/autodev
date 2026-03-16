import { execSync } from "node:child_process";
import { findOutput } from "./hard-gate.js";

// ── Legacy normalization functions (kept for backward compatibility) ──

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

// ── Generic normalization ──

/**
 * Normalize a raw metric value to a 0-100 score.
 *
 * @param {number} value - The raw metric value
 * @param {string} direction - "higher_is_better" or "lower_is_better"
 * @param {number|null} baseline - The baseline value for comparison (used for lower_is_better sizing)
 * @returns {number} Normalized score 0-100
 */
export function normalizeMetric(value, direction, baseline) {
  if (direction === "higher_is_better") {
    // For coverage-like metrics: the value IS the score, capped at 100
    return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
  }

  if (direction === "lower_is_better") {
    if (baseline != null && baseline > 0) {
      // Compare to baseline: score degrades proportionally to increase over baseline
      const score = 100 - ((value - baseline) / baseline) * 100;
      return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
    }
    // For error/warning counts without a meaningful baseline:
    // Each count deducts 20 points from a perfect 100
    const score = 100 - value * 20;
    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
  }

  return 0;
}

// ── Metric value parsing ──

/**
 * Parse a metric value from command output.
 *
 * @param {string} stdout - The raw command output
 * @param {object} metricDef - The metric definition from the template
 * @returns {number|null} Parsed value, or null if parsing failed
 */
function parseMetricValue(stdout, metricDef) {
  const trimmed = (stdout ?? "").trim();

  if (metricDef.parse === "stdout_as_number") {
    // Take the last non-empty line (commands with || echo 0 may have other output)
    const lines = trimmed.split("\n").filter((l) => l.trim() !== "");
    const lastLine = lines.length > 0 ? lines[lines.length - 1].trim() : "";
    const num = parseFloat(lastLine);
    return Number.isFinite(num) ? num : null;
  }

  // Regex-based parsing
  try {
    const regex = new RegExp(metricDef.parse);
    const match = trimmed.match(regex);
    if (match && match[1] !== undefined) {
      const num = parseFloat(match[1]);
      return Number.isFinite(num) ? num : null;
    }
  } catch {
    // Invalid regex — treat as parse failure
  }

  return null;
}

/**
 * Run a single metric command and parse its output.
 *
 * @param {string} name - Metric name
 * @param {object} metricDef - Metric definition from template
 * @param {string} cwd - Working directory
 * @param {object|null} gateResult - Hard gate result (for reusing build output)
 * @returns {{ value: number|null, error: string|null }}
 */
function runMetricCommand(name, metricDef, cwd, gateResult) {
  const command = metricDef.command;
  if (!command) {
    return { value: null, error: "no command defined" };
  }

  // Special case: if the command is "npm run build 2>&1" and we already
  // have build output from the hard gate, reuse it
  if (command.includes("npm run build") && gateResult) {
    const buildOutput = findOutput(gateResult, "build");
    if (buildOutput) {
      const value = parseMetricValue(buildOutput.stdout, metricDef);
      return { value, error: value === null ? "parse failed from gate output" : null };
    }
  }

  try {
    const stdout = execSync(command, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120_000,
    });
    const value = parseMetricValue(stdout, metricDef);
    return { value, error: value === null ? "parse failed" : null };
  } catch (err) {
    // Some commands (grep -c, tsc) exit non-zero but still produce useful output
    const output = (err.stdout ?? "") + (err.stderr ?? "");
    const value = parseMetricValue(output, metricDef);
    return { value, error: value === null ? `command failed: exit ${err.status}` : null };
  }
}

// ── Main entry point ──

/**
 * Collect all metrics defined in the template, run commands, parse output,
 * and produce normalized scores and deltas.
 *
 * @param {object} config - The merged autodev config
 * @param {object} gateResult - Hard gate result (for reusing build output)
 * @param {object|null} baseline - Baseline metrics from previous runs
 * @param {string} cwd - Working directory
 * @returns {object} Metrics object with raw values, _score, and _delta keys
 */
export async function collectMetrics(config, gateResult, baseline, cwd) {
  const metrics = {};

  // Get metric definitions from the template (new structured format)
  const templateMetrics = config.scoring.templateMetrics;

  // If no template metrics defined, try legacy behavior
  if (!templateMetrics || Object.keys(templateMetrics).length === 0) {
    return collectLegacyMetrics(config, gateResult, baseline, cwd);
  }

  for (const [name, metricDef] of Object.entries(templateMetrics)) {
    const { value, error } = runMetricCommand(name, metricDef, cwd, gateResult);

    if (value === null) {
      // Parsing failed — try parse_default
      if (metricDef.parse_default != null) {
        const fallback = parseFloat(metricDef.parse_default);
        if (Number.isFinite(fallback)) {
          metrics[name] = fallback;
          const baselineVal = baseline?.[name] ?? null;
          metrics[`${name}_score`] = normalizeMetric(fallback, metricDef.direction, baselineVal);
          metrics[`${name}_delta`] = baseline ? +(fallback - (baseline[name] ?? 0)).toFixed(1) : 0;
          continue;
        }
      }

      // If optional, skip silently
      if (metricDef.optional === true) {
        continue;
      }

      // Not optional, no default — set zero values
      metrics[name] = 0;
      metrics[`${name}_score`] = metricDef.direction === "lower_is_better" ? 100 : 0;
      metrics[`${name}_delta`] = 0;
      continue;
    }

    // Successfully parsed
    metrics[name] = value;

    const baselineVal = baseline?.[name] ?? null;
    metrics[`${name}_score`] = normalizeMetric(value, metricDef.direction, baselineVal);
    metrics[`${name}_delta`] = baseline
      ? +(value - (baseline[name] ?? 0)).toFixed(1)
      : 0;
  }

  return metrics;
}

// ── Legacy fallback for old-style configs (bundle_size: true, etc.) ──

async function collectLegacyMetrics(config, gateResult, baseline, cwd) {
  const metrics = {};
  const metricsConfig = config.scoring.metrics;

  if (metricsConfig.bundle_size) {
    const buildOutput = findOutput(gateResult, "build");
    metrics.bundle_size = parseBundleSize(buildOutput?.stdout ?? "");
    // Keep legacy key aliases for backward compat
    metrics.bundle_kb = metrics.bundle_size;
    metrics.bundle_score = normalizeBundle(
      metrics.bundle_size,
      baseline?.bundle_kb ?? baseline?.bundle_size ?? metrics.bundle_size
    );
    metrics.bundle_size_score = metrics.bundle_score;
    metrics.bundle_delta = baseline
      ? +(metrics.bundle_size - (baseline.bundle_kb ?? baseline.bundle_size ?? 0)).toFixed(1)
      : 0;
    metrics.bundle_size_delta = metrics.bundle_delta;
  }

  if (metricsConfig.test_coverage) {
    metrics.test_coverage = await collectCoverageLegacy(cwd);
    metrics.coverage_score = normalizeCoverage(metrics.test_coverage);
    metrics.test_coverage_score = metrics.coverage_score;
    metrics.coverage_delta = baseline
      ? +(metrics.test_coverage - (baseline.test_coverage ?? 0)).toFixed(1)
      : 0;
    metrics.test_coverage_delta = metrics.coverage_delta;
  }

  if (metricsConfig.type_errors) {
    metrics.type_errors = await collectTypeErrorsLegacy(cwd);
    metrics.type_score = normalizeTypeErrors(metrics.type_errors);
    metrics.type_errors_score = metrics.type_score;
    metrics.type_delta = baseline
      ? metrics.type_errors - (baseline.type_errors ?? 0)
      : 0;
    metrics.type_errors_delta = metrics.type_delta;
  }

  return metrics;
}

function parseBundleSize(buildOutput) {
  const match = buildOutput.match(
    /First Load JS shared by all\s+([\d.]+)\s*kB/
  );
  return match ? parseFloat(match[1]) : 0;
}

async function collectCoverageLegacy(cwd) {
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

async function collectTypeErrorsLegacy(cwd) {
  try {
    execSync("npx tsc --noEmit 2>&1", { cwd, encoding: "utf-8", timeout: 60_000 });
    return 0;
  } catch (err) {
    const output = err.stdout ?? "";
    const matches = output.match(/error TS/g);
    return matches ? matches.length : 0;
  }
}
