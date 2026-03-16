// server/agent/apply.js — Apply and revert file changes in a git worktree

import { writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { join } from "node:path";
import { execSync } from "node:child_process";

/**
 * Apply a set of file changes and commit them to git.
 *
 * @param {string} worktreePath - Absolute path to the git worktree
 * @param {Array<{path: string, action: string, content: string}>} changes - Changes to apply
 * @param {string} description - Commit message description
 */
export function applyChanges(worktreePath, changes, description) {
  for (const change of changes) {
    const fullPath = join(worktreePath, change.path);

    switch (change.action) {
      case "create":
      case "modify":
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, change.content, "utf-8");
        break;

      case "delete":
        try {
          unlinkSync(fullPath);
        } catch (err) {
          // File may already be gone — not an error
          if (err.code !== "ENOENT") throw err;
        }
        break;

      default:
        throw new Error(`Unknown action: ${change.action}`);
    }
  }

  // Stage all changes and commit
  execSync("git add -A", { cwd: worktreePath, stdio: "pipe" });
  execSync(`git commit -m "experiment: ${description}"`, {
    cwd: worktreePath,
    stdio: "pipe",
  });
}

/**
 * Revert the last commit (hard reset to HEAD~1).
 *
 * @param {string} worktreePath - Absolute path to the git worktree
 */
export function revertLastCommit(worktreePath) {
  execSync("git reset --hard HEAD~1", { cwd: worktreePath, stdio: "pipe" });
}

/**
 * Get the short hash of the current HEAD commit.
 *
 * @param {string} worktreePath - Absolute path to the git worktree
 * @returns {string} Short commit hash
 */
export function getCurrentCommit(worktreePath) {
  const output = execSync("git rev-parse --short HEAD", {
    cwd: worktreePath,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return output.trim();
}
