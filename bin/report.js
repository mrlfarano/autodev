#!/usr/bin/env node

import { parseArgs } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { loadConfig, resolveConfigPath } from "../lib/config.js";
import { generateReportData } from "../reporting/generate.js";
import { renderHtml } from "../reporting/render-html.js";
import { renderMarkdown } from "../reporting/render-md.js";

const { values: args } = parseArgs({
  options: {
    format: { type: "string", default: "html" },
    since: { type: "string" },
    output: { type: "string" },
    config: { type: "string" },
  },
  strict: false,
});

const configPath = resolveConfigPath(args.config);
const config = loadConfig(configPath);
const tsvPath = path.join(config.target, "results.tsv");

if (!fs.existsSync(tsvPath)) {
  console.error(`No results.tsv found at ${tsvPath}`);
  process.exit(1);
}

const data = generateReportData(tsvPath, args.since);

const format = args.format || "html";
const ext = format === "md" ? ".md" : ".html";
const outputPath = args.output || path.join(config.target, `autodev-report${ext}`);

if (format === "md") {
  const md = renderMarkdown(data);
  fs.writeFileSync(outputPath, md, "utf-8");
} else {
  renderHtml(data, outputPath);
}

console.log(`Report generated: ${outputPath}`);
