#!/usr/bin/env node
// Test runner that discovers all *.test.js files under tests/ and passes them to node --test
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const testsDir = join(root, "tests");

function findTestFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTestFiles(full));
    } else if (entry.name.endsWith(".test.js")) {
      files.push(full);
    }
  }
  return files;
}

const testFiles = findTestFiles(testsDir);
const args = ["--test", ...testFiles];

const result = spawnSync(process.execPath, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
