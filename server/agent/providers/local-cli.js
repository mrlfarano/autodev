// server/agent/providers/local-cli.js — CLI-based agent provider (claude, codex, etc.)

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BaseProvider } from "./base.js";
import { parseResponse } from "./parse-response.js";

const execFileAsync = promisify(execFile);

const isWindows = process.platform === "win32";

/**
 * Provider that spawns a local CLI tool (claude, codex, gemini, etc.)
 * as a subprocess with the prompt and parses the response.
 *
 * Config:
 *   tool     — CLI tool name, e.g. "claude", "codex" (required)
 *   path     — explicit path to the binary (optional, defaults to tool name)
 *   timeout  — subprocess timeout in ms (optional, defaults to 120000)
 */
export class LocalCliProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    if (!config.tool) {
      throw new Error("LocalCliProvider requires config.tool");
    }
    this.tool = config.tool;
    this.binPath = config.path || config.tool;
    this.timeout = config.timeout ?? 120_000;
  }

  /**
   * Spawn the CLI tool with `-p {prompt}`, capture stdout, and parse
   * into a structured proposal.
   * @param {string} prompt
   * @returns {Promise<{description: string, category: string, changes: Array}>}
   */
  async propose(prompt) {
    if (!prompt || typeof prompt !== "string") {
      throw new Error("prompt must be a non-empty string");
    }

    const { stdout } = await execFileAsync(this.binPath, ["-p", prompt], {
      timeout: this.timeout,
      maxBuffer: 10 * 1024 * 1024, // 10 MB
      windowsHide: true,
      shell: isWindows,
    });

    const proposal = parseResponse(stdout);
    if (!proposal) {
      throw new Error(
        `Failed to parse response from ${this.tool}: ${stdout.slice(0, 200)}`
      );
    }
    return proposal;
  }

  /**
   * Verify the CLI tool is accessible by running `tool --version`.
   * @returns {Promise<{ok: boolean, version?: string, error?: string}>}
   */
  async test() {
    try {
      const { stdout } = await execFileAsync(this.binPath, ["--version"], {
        timeout: 10_000,
        windowsHide: true,
        shell: isWindows,
      });
      const version = stdout.trim().split(/\r?\n/)[0].trim();
      return { ok: true, version: version || undefined };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}
