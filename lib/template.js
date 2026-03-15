import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");

const DETECT_MAP = [
  { files: ["next.config.ts", "next.config.js"], template: "nextjs" },
];

export function detectTemplate(targetDir) {
  for (const { files, template } of DETECT_MAP) {
    for (const file of files) {
      if (fs.existsSync(path.join(targetDir, file))) return template;
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

function parseTemplate(content) {
  const parts = content.split(/^### Scoring Overrides\s*$/m);
  const agentContext = parts[0].trim();
  const scoringOverrides = {};

  if (parts[1]) {
    const lines = parts[1].trim().split("\n");
    let currentKey = null;
    for (const line of lines) {
      if (line.startsWith("#")) continue;
      const keyMatch = line.match(/^(\w+):$/);
      if (keyMatch) {
        currentKey = keyMatch[1];
        scoringOverrides[currentKey] = [];
        continue;
      }
      const listMatch = line.match(/^\s+-\s+(.+)$/);
      if (listMatch && currentKey && Array.isArray(scoringOverrides[currentKey])) {
        scoringOverrides[currentKey].push(listMatch[1]);
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
  return merged;
}
