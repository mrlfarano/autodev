import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const DEFAULTS = {
  branch_prefix: "autodev",
  budgets: { small: 5, medium: 15, large: 30 },
  scoring: {
    metrics: { bundle_size: true, test_coverage: true, type_errors: true },
  },
};

export function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }

  const raw = yaml.load(fs.readFileSync(configPath, "utf-8"));

  // Expand ~ in target
  if (raw.target && raw.target.startsWith("~")) {
    raw.target = path.join(os.homedir(), raw.target.slice(1));
  }

  // Merge defaults
  const config = {
    ...DEFAULTS,
    ...raw,
    budgets: { ...DEFAULTS.budgets, ...raw.budgets },
    scoring: {
      ...DEFAULTS.scoring,
      ...raw.scoring,
      metrics: { ...DEFAULTS.scoring.metrics, ...raw.scoring?.metrics },
    },
  };

  // Validate required fields
  if (!config.target) {
    throw new Error("Config missing required field: target");
  }
  if (!config.scoring.hard_gate || config.scoring.hard_gate.length === 0) {
    throw new Error("Config missing required field: scoring.hard_gate");
  }
  if (!config.scoring.weights) {
    throw new Error("Config missing required field: scoring.weights");
  }

  // Validate weights sum to 1.0
  const weightSum = Object.values(config.scoring.weights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1.0) > 0.01) {
    throw new Error(
      `Scoring weights must sum to 1.0, got ${weightSum.toFixed(2)}`
    );
  }

  // Validate judge config
  if (!config.scoring.judge) {
    throw new Error("Config missing required field: scoring.judge");
  }

  return config;
}

export function resolveConfigPath(cliConfigPath) {
  if (cliConfigPath) return path.resolve(cliConfigPath);
  if (process.env.AUTODEV_CONFIG) return path.resolve(process.env.AUTODEV_CONFIG);
  const libDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(libDir, "..", "autodev.yaml");
}
