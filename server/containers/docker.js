// server/containers/docker.js — Docker container management

import { exec } from 'node:child_process';

/**
 * Run a shell command and return { stdout, stderr }.
 * Rejects on non-zero exit code.
 */
function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

/**
 * Check whether Docker is available on this machine.
 * @returns {Promise<boolean>}
 */
export async function isDockerAvailable() {
  try {
    await run('docker --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a Docker image from the given context directory.
 * @param {string} contextDir  Path to the build context (must contain a Dockerfile)
 * @param {string} tag         Image tag
 */
export async function dockerBuild(contextDir, tag) {
  const { stdout } = await run(`docker build -t ${tag} ${contextDir}`);
  return stdout;
}

/**
 * Run a Docker container in detached mode with port mapping.
 * @param {string} tag       Image tag to run
 * @param {number} port      Host port to expose
 * @param {number} appPort   Container port the app listens on (default 3000)
 * @returns {Promise<string>} Container ID
 */
export async function dockerRun(tag, port, appPort = 3000) {
  const { stdout } = await run(
    `docker run -d -p ${port}:${appPort} --name autodev-${tag} ${tag}`
  );
  return stdout; // container ID
}

/**
 * Force-remove a container by ID.
 * @param {string} containerId
 */
export async function dockerStop(containerId) {
  await run(`docker rm -f ${containerId}`);
}

/**
 * Force-remove all autodev containers. Errors are silently ignored.
 */
export async function dockerStopAll() {
  try {
    await run('docker rm -f $(docker ps -aq --filter name=autodev-)');
  } catch {
    // ignore — no matching containers or Docker not available
  }
}
