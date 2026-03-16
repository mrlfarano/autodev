// server/scanner.js — scan filesystem for git repositories

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { detectLanguage } from './language-detect.js';

const MAX_REPOS = 50;

/**
 * Get the default set of directories to scan for repos.
 */
function getDefaultBasePaths() {
  const home = os.homedir();
  const paths = [
    path.join(home, 'dev'),
    path.join(home, 'projects'),
    path.join(home, 'repos'),
    path.join(home, 'code'),
  ];

  // Windows-specific paths
  if (process.platform === 'win32') {
    paths.push(path.join(home, 'Documents', 'GitHub'));
    // If home is already under C:/Users, these are redundant but won't hurt
    const user = os.userInfo().username;
    const winDev = `C:/Users/${user}/dev`;
    const winGh = `C:/Users/${user}/Documents/GitHub`;
    if (!paths.includes(winDev)) paths.push(winDev);
    if (!paths.includes(winGh)) paths.push(winGh);
  }

  return paths;
}

/**
 * Run a git command in a directory, returning stdout or null on failure.
 */
function git(repoPath, args) {
  try {
    return execSync(`git ${args}`, {
      cwd: repoPath,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Check if a directory is a git repo (contains .git/).
 */
function isGitRepo(dirPath) {
  try {
    return fs.statSync(path.join(dirPath, '.git')).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Scan base paths (2 levels deep) for git repositories.
 *
 * @param {string[]} [basePaths]  Directories to scan; defaults to common locations
 * @returns {Promise<Array<{ path: string, name: string, detectedLanguage: object, lastCommit: string|null, branch: string|null }>>}
 */
export async function scanRepos(basePaths) {
  const dirs = basePaths || getDefaultBasePaths();
  const repos = [];

  for (const baseDir of dirs) {
    // Skip base paths that don't exist
    try {
      if (!fs.statSync(baseDir).isDirectory()) continue;
    } catch {
      continue;
    }

    // Level 0 — the base dir itself could be a repo
    if (isGitRepo(baseDir)) {
      repos.push(baseDir);
      if (repos.length >= MAX_REPOS) break;
      continue;
    }

    // Level 1
    let level1;
    try {
      level1 = fs.readdirSync(baseDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry1 of level1) {
      if (!entry1.isDirectory()) continue;
      if (entry1.name.startsWith('.') || entry1.name === 'node_modules') continue;

      const dir1 = path.join(baseDir, entry1.name);

      if (isGitRepo(dir1)) {
        repos.push(dir1);
        if (repos.length >= MAX_REPOS) break;
        continue;
      }

      // Level 2
      let level2;
      try {
        level2 = fs.readdirSync(dir1, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry2 of level2) {
        if (!entry2.isDirectory()) continue;
        if (entry2.name.startsWith('.') || entry2.name === 'node_modules') continue;

        const dir2 = path.join(dir1, entry2.name);
        if (isGitRepo(dir2)) {
          repos.push(dir2);
          if (repos.length >= MAX_REPOS) break;
        }
      }

      if (repos.length >= MAX_REPOS) break;
    }

    if (repos.length >= MAX_REPOS) break;
  }

  // Build result objects
  const results = [];
  for (const repoPath of repos) {
    try {
      const name = path.basename(repoPath);
      const lastCommit = git(repoPath, 'log -1 --format=%ci');
      const branch = git(repoPath, 'branch --show-current');
      const detectedLanguage = detectLanguage(repoPath);

      results.push({
        path: repoPath.replace(/\\/g, '/'),
        name,
        detectedLanguage: detectedLanguage.language || 'unknown',
        framework: detectedLanguage.framework || '',
        template: detectedLanguage.template || 'generic',
        lastCommit,
        branch,
      });
    } catch {
      // Skip repos that cause errors during info gathering
    }
  }

  return results;
}
