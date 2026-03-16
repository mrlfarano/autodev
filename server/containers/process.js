// server/containers/process.js — Direct process management (Docker fallback)

import { spawn } from 'node:child_process';

/**
 * Manages child processes for experiments when Docker is not available.
 * Each experiment gets a spawned process tracked by experimentId.
 */
export class ProcessManager {
  constructor() {
    /** @type {Map<string, { child: import('node:child_process').ChildProcess, port: number }>} */
    this.processes = new Map();
  }

  /**
   * Start a process for an experiment.
   * @param {string} experimentId  Unique experiment identifier
   * @param {string} cwd           Working directory for the process
   * @param {string} command        Shell command to run (e.g. 'npm start')
   * @param {number} port           Port the app should listen on (passed as PORT env var)
   * @returns {Promise<{ pid: number, port: number }>}
   */
  async start(experimentId, cwd, command, port) {
    const [cmd, ...args] = command.split(/\s+/);

    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, PORT: String(port) },
      stdio: 'pipe',
      shell: true,
    });

    // Capture output for debugging but don't let it block
    child.stdout?.on('data', () => {});
    child.stderr?.on('data', () => {});

    this.processes.set(experimentId, { child, port });

    return { pid: child.pid, port };
  }

  /**
   * Stop a specific experiment's process.
   * @param {string} experimentId
   */
  stop(experimentId) {
    const entry = this.processes.get(experimentId);
    if (!entry) return;

    try {
      entry.child.kill('SIGTERM');
    } catch {
      // process may have already exited
    }
    this.processes.delete(experimentId);
  }

  /** Stop all tracked processes. */
  stopAll() {
    for (const [id] of this.processes) {
      this.stop(id);
    }
  }

  /**
   * Check whether a process is still running.
   * @param {string} experimentId
   * @returns {boolean}
   */
  isRunning(experimentId) {
    const entry = this.processes.get(experimentId);
    if (!entry) return false;

    // child.exitCode is null while the process is running
    return entry.child.exitCode === null;
  }
}
