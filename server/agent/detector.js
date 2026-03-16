// server/agent/detector.js — Detect installed CLI tools for agent orchestration

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const TOOLS = ["claude", "codex", "gemini", "opencode", "pi", "docker"];

const isWindows = process.platform === "win32";

/**
 * Run a command and return trimmed stdout, or null on failure.
 */
async function tryExec(cmd, args, timeout = 5000) {
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      timeout,
      windowsHide: true,
      shell: isWindows,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Detect the version of a CLI tool by running `tool --version`.
 * Returns the first non-empty line of output, or null.
 */
async function detectVersion(tool) {
  const output = await tryExec(tool, ["--version"]);
  if (!output) return null;
  // Take only the first line (some tools emit multi-line output)
  const firstLine = output.split(/\r?\n/)[0].trim();
  return firstLine || null;
}

/**
 * Detect the filesystem path of a CLI tool.
 * Uses `where` on Windows, `which` on Unix.
 */
async function detectPath(tool) {
  const locateCmd = isWindows ? "where" : "which";
  const output = await tryExec(locateCmd, [tool]);
  if (!output) return null;
  // `where` on Windows may return multiple lines; take the first
  const firstLine = output.split(/\r?\n/)[0].trim();
  return firstLine || null;
}

/**
 * Probe a single tool for availability, version, and path.
 * @param {string} name — tool name (e.g. "claude", "docker")
 * @returns {Promise<{name: string, available: boolean, version: string|null, path: string|null}>}
 */
async function detectTool(name) {
  const [version, toolPath] = await Promise.all([
    detectVersion(name),
    detectPath(name),
  ]);

  return {
    name,
    available: version !== null || toolPath !== null,
    version: version ?? null,
    path: toolPath ?? null,
  };
}

/**
 * Detect all known CLI tools in parallel.
 * @param {string[]} [tools] — optional override of tool names to check
 * @returns {Promise<Array<{name: string, available: boolean, version: string|null, path: string|null}>>}
 */
export async function detectTools(tools = TOOLS) {
  return Promise.all(tools.map(detectTool));
}

export { TOOLS, detectTool };
