import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");

const DETECT_MAP = [
  { files: ["next.config.ts", "next.config.js", "next.config.mjs"], template: "nextjs" },
  { files: ["Cargo.toml"], template: "rust" },
  { files: ["go.mod"], template: "go" },
  { files: ["pom.xml"], template: "java-maven" },
  { files: ["build.gradle", "build.gradle.kts"], template: "java-gradle" },
  { files: ["manage.py"], template: "python" },
  { files: ["pyproject.toml", "setup.py", "requirements.txt"], template: "python" },
  { files: ["Gemfile"], template: "ruby" },
  { files: ["*.csproj"], template: "csharp" },
  { files: ["tsconfig.json"], template: "typescript" },
  { files: ["package.json"], template: "typescript" },
];

/**
 * Check if a file pattern matches any file in the directory.
 * Supports simple glob patterns like "*.csproj".
 */
function fileMatchExists(targetDir, filePattern) {
  if (filePattern.includes("*")) {
    // Glob pattern — check directory entries
    const ext = filePattern.replace("*", "");
    try {
      const entries = fs.readdirSync(targetDir);
      return entries.some((entry) => entry.endsWith(ext));
    } catch {
      return false;
    }
  }
  return fs.existsSync(path.join(targetDir, filePattern));
}

export function detectTemplate(targetDir) {
  for (const { files, template } of DETECT_MAP) {
    for (const file of files) {
      if (fileMatchExists(targetDir, file)) return template;
    }
  }
  return "generic";
}

export function loadTemplate(nameOrPath) {
  if (nameOrPath.startsWith(".") || nameOrPath.startsWith("/")) {
    const content = fs.readFileSync(nameOrPath, "utf-8");
    return parseTemplate(content);
  }
  const filePath = path.join(TEMPLATES_DIR, `${nameOrPath}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Template not found: ${nameOrPath} (looked in ${TEMPLATES_DIR})`);
  }
  return parseTemplate(fs.readFileSync(filePath, "utf-8"));
}

/**
 * Parse a template markdown file into structured data.
 *
 * The file has two sections separated by `### Scoring Overrides`.
 * The scoring overrides section uses a YAML-like format:
 *
 *   hard_gate:
 *     - cmd1
 *     - cmd2
 *
 *   metrics:
 *     metric_name:
 *       command: "..."
 *       parse: "..."
 *       direction: higher_is_better
 *       parse_default: "0"
 *       optional: true
 */
function parseTemplate(content) {
  const parts = content.split(/^### Scoring Overrides\s*$/m);
  const agentContext = parts[0].trim();
  const scoringOverrides = {};

  if (parts[1]) {
    const lines = parts[1].trim().split("\n");
    let currentTopKey = null; // "hard_gate" or "metrics"
    let currentMetricName = null;

    for (const line of lines) {
      // Skip markdown headings and blank lines
      if (line.startsWith("#") || line.trim() === "") continue;

      // Top-level key (no indentation): e.g. "hard_gate:" or "metrics:"
      const topKeyMatch = line.match(/^(\w+):\s*$/);
      if (topKeyMatch) {
        currentTopKey = topKeyMatch[1];
        currentMetricName = null;
        if (currentTopKey === "hard_gate") {
          scoringOverrides.hard_gate = [];
        } else if (currentTopKey === "metrics") {
          scoringOverrides.metrics = {};
        }
        continue;
      }

      // List item under hard_gate: "  - command"
      if (currentTopKey === "hard_gate") {
        const listMatch = line.match(/^\s+-\s+(.+)$/);
        if (listMatch) {
          scoringOverrides.hard_gate.push(listMatch[1]);
        }
        continue;
      }

      // Inside metrics section
      if (currentTopKey === "metrics") {
        // Metric name (2-space indent): "  metric_name:"
        const metricNameMatch = line.match(/^  (\w+):\s*$/);
        if (metricNameMatch) {
          currentMetricName = metricNameMatch[1];
          scoringOverrides.metrics[currentMetricName] = {};
          continue;
        }

        // Metric property (4-space indent): "    key: value"
        if (currentMetricName) {
          const propMatch = line.match(/^\s{4,}(\w+):\s+(.+)$/);
          if (propMatch) {
            const key = propMatch[1];
            let value = propMatch[2].trim();

            // Strip surrounding quotes from values
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }

            // Convert boolean and numeric values
            if (value === "true") value = true;
            else if (value === "false") value = false;

            scoringOverrides.metrics[currentMetricName][key] = value;
          }
        }
      }
    }
  }

  return { agentContext, scoringOverrides };
}

export function mergeTemplateDefaults(config, template) {
  const merged = structuredClone(config);
  if (!merged.scoring.hard_gate && template.scoringOverrides.hard_gate) {
    merged.scoring.hard_gate = template.scoringOverrides.hard_gate;
  }
  // Merge template metrics definitions into config if not already set
  if (template.scoringOverrides.metrics) {
    if (!merged.scoring.templateMetrics) {
      merged.scoring.templateMetrics = template.scoringOverrides.metrics;
    }
  }
  return merged;
}
