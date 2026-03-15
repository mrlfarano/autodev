import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function renderHtml(reportData, outputPath) {
  const template = fs.readFileSync(path.join(__dirname, "template.html"), "utf-8");
  const html = template.replace(
    "{{DATA}}",
    JSON.stringify(reportData)
  );
  fs.writeFileSync(outputPath, html, "utf-8");
}
