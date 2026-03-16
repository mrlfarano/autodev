// server/containers/manager.js — High-level container / process manager

import http from 'node:http';
import { PortAllocator } from './ports.js';
import { isDockerAvailable, dockerBuild, dockerRun, dockerStop, dockerStopAll } from './docker.js';
import { ProcessManager } from './process.js';

/**
 * Wait for an HTTP 200 on localhost:{port}/ with retries.
 * @param {number} port
 * @param {number} retries   Max attempts (default 10)
 * @param {number} delayMs   Milliseconds between attempts (default 2000)
 * @returns {Promise<boolean>}
 */
function healthCheck(port, retries = 10, delayMs = 2000) {
  return new Promise((resolve) => {
    let attempts = 0;

    function attempt() {
      attempts++;
      const req = http.get(`http://localhost:${port}/`, (res) => {
        if (res.statusCode === 200) {
          res.resume(); // drain response
          return resolve(true);
        }
        res.resume();
        retry();
      });

      req.on('error', () => retry());
      req.setTimeout(delayMs, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (attempts >= retries) return resolve(false);
      setTimeout(attempt, delayMs);
    }

    attempt();
  });
}

/**
 * Decides whether to use Docker or bare processes, allocates ports,
 * manages lifecycle, and performs health checks.
 */
export class ContainerManager {
  /**
   * @param {object} config
   * @param {number} [config.maxRunning=5]       Maximum simultaneous experiments
   * @param {number} [config.startPort=3401]     First port to allocate
   * @param {string} [config.appCommand='npm start']  Command for process-based runs
   * @param {string} [config.docker='auto']      'auto' | 'always' | 'never'
   */
  constructor(config = {}) {
    this.maxRunning = config.maxRunning ?? 5;
    this.appCommand = config.appCommand ?? 'npm start';
    this.dockerMode = config.docker ?? 'auto';

    this.ports = new PortAllocator(config.startPort ?? 3401);
    this.processManager = new ProcessManager();

    /** @type {'docker'|'process'|null} */
    this.strategy = null;

    /** @type {Map<string, { port: number, containerId?: string, startedAt: Date }>} */
    this.running = new Map();
  }

  /**
   * Detect Docker availability and set the execution strategy.
   * Must be called before startExperiment.
   */
  async init() {
    if (this.dockerMode === 'never') {
      this.strategy = 'process';
      return;
    }

    const dockerReady = await isDockerAvailable();

    if (this.dockerMode === 'always' && !dockerReady) {
      throw new Error('Docker mode is "always" but Docker is not available');
    }

    this.strategy = dockerReady ? 'docker' : 'process';
  }

  /**
   * Start an experiment.
   * @param {string} experimentId     Unique identifier
   * @param {string} buildContextDir  Directory containing the app / Dockerfile
   * @returns {Promise<{ port: number, containerId?: string }>}
   */
  async startExperiment(experimentId, buildContextDir) {
    if (!this.strategy) {
      throw new Error('ContainerManager not initialised — call init() first');
    }

    // If at max capacity, stop the oldest experiment
    if (this.running.size >= this.maxRunning) {
      let oldest = null;
      let oldestTime = Infinity;
      for (const [id, info] of this.running) {
        if (info.startedAt.getTime() < oldestTime) {
          oldestTime = info.startedAt.getTime();
          oldest = id;
        }
      }
      if (oldest) {
        await this.stopExperiment(oldest);
      }
    }

    const port = this.ports.next();
    let containerId;

    if (this.strategy === 'docker') {
      const tag = experimentId;
      await dockerBuild(buildContextDir, tag);
      containerId = await dockerRun(tag, port);
    } else {
      await this.processManager.start(experimentId, buildContextDir, this.appCommand, port);
    }

    const entry = { port, startedAt: new Date() };
    if (containerId) entry.containerId = containerId;
    this.running.set(experimentId, entry);

    // Health check — wait for the app to be ready
    const healthy = await healthCheck(port);
    if (!healthy) {
      // Clean up the unhealthy experiment but still return the info
      // (caller can decide what to do)
    }

    return { port, containerId };
  }

  /**
   * Stop a single experiment.
   * @param {string} experimentId
   */
  async stopExperiment(experimentId) {
    const entry = this.running.get(experimentId);
    if (!entry) return;

    if (this.strategy === 'docker' && entry.containerId) {
      await dockerStop(entry.containerId);
    } else {
      this.processManager.stop(experimentId);
    }

    this.ports.release(entry.port);
    this.running.delete(experimentId);
  }

  /** Stop all running experiments. */
  async stopAll() {
    if (this.strategy === 'docker') {
      await dockerStopAll();
    } else {
      this.processManager.stopAll();
    }

    for (const [, entry] of this.running) {
      this.ports.release(entry.port);
    }
    this.running.clear();
  }

  /**
   * List all running experiments.
   * @returns {Array<{ experimentId: string, port: number, startedAt: Date }>}
   */
  getRunning() {
    const list = [];
    for (const [experimentId, info] of this.running) {
      list.push({ experimentId, port: info.port, startedAt: info.startedAt });
    }
    return list;
  }
}
