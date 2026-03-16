// server/agent/loop.js — Main experiment loop controller

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { AgentEvents } from "./events.js";
import { buildPrompt } from "./prompt.js";
import { applyChanges, revertLastCommit, getCurrentCommit } from "./apply.js";
import { ApiKeyProvider } from "./providers/api-key.js";
import { LocalCliProvider } from "./providers/local-cli.js";
import { LocalLlmProvider } from "./providers/local-llm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN_SCORE = path.resolve(__dirname, "..", "..", "bin", "score.js");

// ── Phases ──

const PHASE = {
  IDLE: "idle",
  STARTING: "starting",
  ANALYZING: "analyzing",
  PROPOSING: "proposing",
  APPLYING: "applying",
  SCORING: "scoring",
  DECIDING: "deciding",
  STOPPED: "stopped",
};

// ── Helpers ──

/**
 * Format milliseconds as human-readable duration (e.g. "42m", "1h 23m").
 */
export function formatDuration(ms) {
  if (ms < 1000) return "0m";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Parse a time-limit string like "8h", "30m", "1h30m" into milliseconds.
 */
function parseTimeLimit(str) {
  if (!str || typeof str !== "string") return Infinity;
  let ms = 0;
  const hourMatch = str.match(/(\d+)\s*h/i);
  const minMatch = str.match(/(\d+)\s*m/i);
  if (hourMatch) ms += parseInt(hourMatch[1], 10) * 3600_000;
  if (minMatch) ms += parseInt(minMatch[1], 10) * 60_000;
  return ms > 0 ? ms : Infinity;
}

// ── ExperimentLoop ──

export class ExperimentLoop {
  /**
   * @param {object} config — full resolved config (from loadConfig + UI overrides)
   */
  constructor(config) {
    this.config = config;
    this.events = new AgentEvents();

    // State
    this.status = PHASE.IDLE;
    this.runId = null;
    this.phase = PHASE.IDLE;
    this.currentExperiment = 0;
    this.baselineScore = null;
    this.latestScore = null;
    this.worktreePath = null;

    // Experiment records
    this.experiments = [];

    // Stats
    this.startTime = null;
    this.total = 0;
    this.kept = 0;
    this.discarded = 0;
    this.crashed = 0;

    // Limits
    this.maxExperiments = config.run?.maxExperiments ?? 50;
    this.timeLimitMs = parseTimeLimit(config.run?.timeLimit);

    // Stopping flag
    this._stopping = false;
  }

  /**
   * Create the appropriate provider based on config.agent.
   */
  createProvider() {
    const agent = this.config.agent || {};
    const type = agent.type || "local-llm";

    switch (type) {
      case "api-key":
      case "anthropic":
      case "openai":
        return new ApiKeyProvider({
          provider: agent.provider || type,
          model: agent.model,
          api_key: agent.apiKey || agent.api_key,
          max_tokens: agent.max_tokens,
        });

      case "local-cli":
        return new LocalCliProvider({
          tool: agent.tool,
          path: agent.path,
          timeout: agent.timeout,
        });

      case "local-llm":
      case "local-inference":
        return new LocalLlmProvider({
          endpoint: agent.endpoint || "http://localhost:11434",
          model: agent.model || "qwen3:4b",
          timeout: agent.timeout,
        });

      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }

  /**
   * Start the experiment loop.
   * Sets up worktree, runs baseline score, then enters the loop.
   *
   * @param {string} tag — experiment tag (used for branch name)
   */
  async start(tag) {
    const now = new Date();
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    this.runId = tag || `${months[now.getMonth()]}${now.getDate()}${String.fromCharCode(97 + Math.floor(Math.random() * 26))}`;
    this.startTime = Date.now();
    this._stopping = false;
    this.status = PHASE.STARTING;
    this.phase = PHASE.STARTING;

    const targetDir = this.config.target;
    const branchName = `autodev/${this.runId}`;
    this.worktreePath = path.join(targetDir, ".autodev-work");

    this.events.emitStatus({ status: "starting", runId: this.runId, branch: branchName });
    this.events.emitLog(`Starting experiment run ${this.runId}`);

    try {
      // Setup git worktree
      this._setupWorktree(targetDir, branchName);
      this.events.emitLog(`Worktree created at ${this.worktreePath}`);

      // Run baseline score (non-fatal — if it fails, start from 0)
      this.events.emitLog("Running baseline score...");
      try {
        const baseline = this._runScore(this.worktreePath);
        this.baselineScore = baseline.composite_score ?? 0;
        this.latestScore = this.baselineScore;
        this.events.emitScore({ composite: this.baselineScore, baseline: true });
        this.events.emitLog(`Baseline score: ${this.baselineScore}`);
      } catch (baselineErr) {
        console.error('[autodev loop] Baseline score failed (non-fatal):', baselineErr.message);
        this.baselineScore = 0;
        this.latestScore = 0;
        this.events.emitLog(`Baseline score failed: ${baselineErr.message} — starting from 0`);
        this.events.emitScore({ composite: 0, baseline: true });
      }

      // Enter main loop
      this.status = "running";
      await this._runLoop();
    } catch (err) {
      console.error('[autodev loop] Fatal error:', err.message, err.stack);
      this.events.emitLog(`Fatal error: ${err.message}`);
      this.events.emitStatus({ status: "error", error: err.message });
    } finally {
      // Cleanup worktree
      this._cleanupWorktree(targetDir);
      this.status = PHASE.STOPPED;
      this.phase = PHASE.STOPPED;
      this.events.emitStatus({
        status: "stopped",
        runId: this.runId,
        stats: this.getStats(),
      });
      this.events.emitLog(`Run ${this.runId} finished. ${this.kept} kept, ${this.discarded} discarded, ${this.crashed} crashed.`);
    }
  }

  /**
   * Signal the loop to stop after the current experiment.
   */
  stop() {
    this._stopping = true;
    this.status = "stopping";
    this.events.emitStatus({ status: "stopping" });
    this.events.emitLog("Stop requested — will finish current experiment.");
  }

  /**
   * Return the current status of the loop.
   */
  getStatus() {
    return {
      status: this.status,
      runId: this.runId,
      currentExperiment: this.currentExperiment,
      phase: this.phase,
      stats: this.getStats(),
      latestScore: this.latestScore,
      baselineScore: this.baselineScore,
    };
  }

  /**
   * Return experiment statistics.
   */
  getStats() {
    const elapsed = this.startTime ? Date.now() - this.startTime : 0;
    const remaining = this.timeLimitMs !== Infinity
      ? Math.max(0, this.timeLimitMs - elapsed)
      : null;

    return {
      total: this.total,
      kept: this.kept,
      discarded: this.discarded,
      crashed: this.crashed,
      elapsed: formatDuration(elapsed),
      remaining: remaining !== null ? formatDuration(remaining) : null,
    };
  }

  // ──────────────────────────────────────────────
  // Private methods
  // ──────────────────────────────────────────────

  /**
   * Set up the git branch and worktree.
   */
  _setupWorktree(targetDir, branchName) {
    // Create branch if it doesn't exist
    try {
      execSync(`git branch ${branchName}`, {
        cwd: targetDir,
        stdio: "pipe",
      });
    } catch {
      // Branch may already exist — ignore
    }

    // Remove stale worktree if present
    try {
      execSync("git worktree remove .autodev-work --force", {
        cwd: targetDir,
        stdio: "pipe",
      });
    } catch {
      // May not exist — ignore
    }

    // Add worktree
    execSync(`git worktree add .autodev-work ${branchName}`, {
      cwd: targetDir,
      stdio: "pipe",
    });
  }

  /**
   * Clean up the worktree.
   */
  _cleanupWorktree(targetDir) {
    try {
      execSync("git worktree remove .autodev-work --force", {
        cwd: targetDir,
        stdio: "pipe",
      });
    } catch {
      // Best effort
    }
  }

  /**
   * Main experiment loop.
   */
  async _runLoop() {
    const provider = this.createProvider();

    while (!this._stopping) {
      // Check experiment limit
      if (this.total >= this.maxExperiments) {
        this.events.emitLog(`Reached max experiments (${this.maxExperiments}).`);
        break;
      }

      // Check time limit
      if (this.startTime && Date.now() - this.startTime >= this.timeLimitMs) {
        this.events.emitLog(`Reached time limit (${formatDuration(this.timeLimitMs)}).`);
        break;
      }

      // Increment and emit
      this.total++;
      this.currentExperiment = this.total;
      this.events.emitStats(this.getStats());

      // Run one experiment
      const result = await this._runExperiment(provider);

      // Record the result
      this.experiments.push(result);

      if (result.status === "kept") {
        this.kept++;
        this.latestScore = result.score;
        this.events.emitLog(`Experiment #${this.currentExperiment}: KEPT (score ${result.score})`);
      } else if (result.status === "discarded") {
        this.discarded++;
        this.events.emitLog(`Experiment #${this.currentExperiment}: DISCARDED (score ${result.score})`);
      } else {
        this.crashed++;
        this.events.emitLog(`Experiment #${this.currentExperiment}: CRASHED — ${result.error}`);
      }

      this.events.emitExperimentComplete(result);
      this.events.emitStats(this.getStats());
    }
  }

  /**
   * Run a single experiment: analyze → propose → apply → score → decide.
   */
  async _runExperiment(provider) {
    const experimentNum = this.currentExperiment;
    const startMs = Date.now();

    try {
      // ── ANALYZING ──
      this.phase = PHASE.ANALYZING;
      this.events.emitStatus({ status: "running", phase: PHASE.ANALYZING, experiment: experimentNum });

      const tree = this._getTree(this.worktreePath);
      const keyFiles = this._getKeyFiles(this.worktreePath);
      const metrics = this._getCurrentMetrics();
      const history = this.experiments.slice(-5); // last 5 experiments

      const prompt = buildPrompt({
        projectName: path.basename(this.config.target),
        language: this.config.language || "unknown",
        framework: this.config.framework || "",
        tree,
        keyFiles,
        history: history.map((e) => ({
          experiment: e.experiment,
          score: e.score,
          status: e.status,
          description: e.description,
        })),
        metrics,
        aggressiveness: this.config.run?.aggressiveness || "balanced",
        creativity: this.config.run?.creativity || "moderate",
      });

      // ── PROPOSING ──
      this.phase = PHASE.PROPOSING;
      this.events.emitStatus({ status: "running", phase: PHASE.PROPOSING, experiment: experimentNum });
      this.events.emitLog(`Experiment #${experimentNum}: proposing changes...`);

      const proposal = await provider.propose(prompt);

      // ── APPLYING ──
      this.phase = PHASE.APPLYING;
      this.events.emitStatus({ status: "running", phase: PHASE.APPLYING, experiment: experimentNum });
      this.events.emitLog(`Experiment #${experimentNum}: applying "${proposal.description}"`);

      applyChanges(this.worktreePath, proposal.changes, proposal.description);
      const commit = getCurrentCommit(this.worktreePath);

      // ── SCORING ──
      this.phase = PHASE.SCORING;
      this.events.emitStatus({ status: "running", phase: PHASE.SCORING, experiment: experimentNum });
      this.events.emitLog(`Experiment #${experimentNum}: scoring...`);

      let scoreResult;
      try {
        scoreResult = this._runScore(this.worktreePath);
      } catch (scoreErr) {
        // Scoring failure (gate fail, etc.) counts as CRASH
        this.phase = PHASE.DECIDING;
        revertLastCommit(this.worktreePath);
        return {
          experiment: experimentNum,
          status: "crashed",
          description: proposal.description,
          category: proposal.category,
          score: null,
          commit,
          error: `Score failed: ${scoreErr.message}`,
          durationMs: Date.now() - startMs,
        };
      }

      // ── DECIDING ──
      this.phase = PHASE.DECIDING;
      this.events.emitStatus({ status: "running", phase: PHASE.DECIDING, experiment: experimentNum });

      const composite = scoreResult.composite_score;
      const previousScore = this.latestScore ?? this.baselineScore;

      this.events.emitScore({
        composite,
        previous: previousScore,
        experiment: experimentNum,
      });

      const verdict = scoreResult.verdict;

      if (verdict === "KEEP" || (composite !== null && previousScore !== null && composite > previousScore)) {
        // KEEP — advance branch
        return {
          experiment: experimentNum,
          status: "kept",
          description: proposal.description,
          category: proposal.category,
          score: composite,
          commit,
          metrics: scoreResult,
          durationMs: Date.now() - startMs,
        };
      } else {
        // DISCARD — revert
        revertLastCommit(this.worktreePath);
        return {
          experiment: experimentNum,
          status: "discarded",
          description: proposal.description,
          category: proposal.category,
          score: composite,
          commit,
          metrics: scoreResult,
          durationMs: Date.now() - startMs,
        };
      }
    } catch (err) {
      // CRASH — revert and record
      this.phase = PHASE.DECIDING;
      try {
        revertLastCommit(this.worktreePath);
      } catch {
        // May not have a commit to revert — ignore
      }
      return {
        experiment: experimentNum,
        status: "crashed",
        description: err.message,
        category: "error",
        score: null,
        commit: null,
        error: err.message,
        durationMs: Date.now() - startMs,
      };
    }
  }

  /**
   * Get directory tree of the worktree (excluding common noise).
   */
  _getTree(cwd) {
    try {
      const output = execSync(
        'find . -type f ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/.next/*" ! -path "*/dist/*" ! -path "*/.autodev-work/*" | head -50',
        { cwd, encoding: "utf-8", timeout: 10_000, stdio: ["pipe", "pipe", "pipe"] }
      );
      return output.trim();
    } catch {
      return "";
    }
  }

  /**
   * Read a handful of key files from the worktree for context.
   * Returns array of { path, content }.
   */
  _getKeyFiles(cwd) {
    const candidates = [
      "README.md",
      "package.json",
      "src/index.js",
      "src/index.ts",
      "src/app/page.tsx",
      "src/app/layout.tsx",
      "app/page.tsx",
      "app/layout.tsx",
      "src/main.py",
      "main.go",
      "Cargo.toml",
    ];

    const maxSize = 10 * 1024; // 10 KB
    const files = [];

    for (const relPath of candidates) {
      const fullPath = path.join(cwd, relPath);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && stat.size <= maxSize) {
          const content = fs.readFileSync(fullPath, "utf-8");
          files.push({ path: relPath, content });
        }
      } catch {
        // File doesn't exist — skip
      }
      if (files.length >= 5) break;
    }

    return files;
  }

  /**
   * Return current metrics from the last kept experiment.
   */
  _getCurrentMetrics() {
    // Walk backwards to find the last kept experiment
    for (let i = this.experiments.length - 1; i >= 0; i--) {
      if (this.experiments[i].status === "kept" && this.experiments[i].metrics) {
        return this.experiments[i].metrics;
      }
    }
    return {};
  }

  /**
   * Run scoring directly: execute hard gate commands and compute a score.
   * Returns { composite_score, gate, verdict, gateResults[] }
   */
  _runScore(cwd) {
    const gates = this.config.scoring?.hard_gate || [];
    const gateResults = [];
    let allPassed = true;

    for (const cmd of gates) {
      this.events.emitLog(`  Gate: ${cmd}`);
      try {
        const output = execSync(cmd, {
          cwd,
          encoding: "utf-8",
          timeout: 300_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
        gateResults.push({ command: cmd, passed: true, output: output.slice(0, 500) });
        this.events.emitLog(`  Gate PASS: ${cmd}`);
      } catch (err) {
        allPassed = false;
        const stderr = (err.stderr || "").slice(0, 300);
        gateResults.push({ command: cmd, passed: false, error: stderr });
        this.events.emitLog(`  Gate FAIL: ${cmd} — ${stderr.slice(0, 100)}`);
      }
    }

    if (!allPassed) {
      throw new Error("Hard gate failed: " + gateResults.filter(g => !g.passed).map(g => g.command).join(", "));
    }

    // Simple scoring: gates passed = base score of 50
    // Add points for number of gates passed, files changed, etc.
    const baseScore = 50;
    const gateBonus = gateResults.length * 10; // 10 points per gate
    const composite = Math.min(100, baseScore + gateBonus);

    return {
      composite_score: composite,
      gate: "PASS",
      verdict: "KEEP",
      gateResults,
    };
  }
}
