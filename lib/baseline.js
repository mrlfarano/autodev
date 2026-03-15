import fs from "node:fs";
import path from "node:path";

const BASELINE_FILE = ".autodev-baseline.json";

export function readBaseline(targetDir) {
  const filePath = path.join(targetDir, BASELINE_FILE);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function writeBaseline(targetDir, metrics) {
  const filePath = path.join(targetDir, BASELINE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2), "utf-8");
}
