// server/api.js — REST API route handlers for autodev

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { execSync } from 'node:child_process';
import yaml from 'js-yaml';
import { scanRepos } from './scanner.js';
import { detectLanguage } from './language-detect.js';
import { ExperimentLoop } from './agent/loop.js';
import { detectTools } from './agent/detector.js';
import { loadConfig, resolveConfigPath } from '../lib/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VERSION = '0.2.0';

let experimentLoop = null;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Auto-detect hard gate commands by inspecting the target project.
 * Checks for package.json scripts, Cargo.toml, go.mod, etc.
 */
function detectGatesFromRepo(repoPath) {
  const gates = [];

  // Check for frontend/ subdirectory with its own package.json
  const frontendPkg = path.join(repoPath, 'frontend', 'package.json');
  const rootPkg = path.join(repoPath, 'package.json');

  if (fs.existsSync(frontendPkg)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(frontendPkg, 'utf8'));
      if (pkg.scripts?.build) gates.push('cd frontend && npm run build');
      if (pkg.scripts?.lint) gates.push('cd frontend && npm run lint');
    } catch { /* ignore */ }
  } else if (fs.existsSync(rootPkg)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(rootPkg, 'utf8'));
      if (pkg.scripts?.build) gates.push('npm run build');
      if (pkg.scripts?.lint) gates.push('npm run lint');
    } catch { /* ignore */ }
  }

  // Python
  if (fs.existsSync(path.join(repoPath, 'pyproject.toml')) || fs.existsSync(path.join(repoPath, 'requirements.txt'))) {
    if (fs.existsSync(path.join(repoPath, 'backend'))) {
      // Has a backend/ dir — likely a multi-project setup
      // Don't add Python gates that might not work without venv
    }
  }

  // Rust
  if (fs.existsSync(path.join(repoPath, 'Cargo.toml'))) {
    gates.push('cargo build 2>&1', 'cargo test 2>&1');
  }

  // Go
  if (fs.existsSync(path.join(repoPath, 'go.mod'))) {
    gates.push('go build ./...', 'go test ./...');
  }

  return gates.length > 0 ? gates : ['echo "no gate configured"'];
}

function error(res, message, status = 400) {
  json(res, { ok: false, error: message }, status);
}

/**
 * Make a simple HTTP(S) request and return { status, body }.
 */
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, options, (resp) => {
      const chunks = [];
      resp.on('data', (c) => chunks.push(c));
      resp.on('end', () => {
        resolve({
          status: resp.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    if (options.timeout) {
      req.setTimeout(options.timeout, () => {
        req.destroy(new Error('Request timed out'));
      });
    }
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ------------------------------------------------------------------
// Supported languages list
// ------------------------------------------------------------------

const LANGUAGES = [
  { id: 'python', name: 'Python', icon: '\u{1F40D}', frameworks: ['FastAPI', 'Django', 'Flask', 'Generic'] },
  { id: 'rust', name: 'Rust', icon: '\u{1F980}', frameworks: ['Generic Rust'] },
  { id: 'go', name: 'Go', icon: '\u{1F439}', frameworks: ['Generic Go'] },
  { id: 'java', name: 'Java', icon: '\u2615', frameworks: ['Maven', 'Gradle'] },
  { id: 'typescript', name: 'TypeScript', icon: '\u{1F48E}', frameworks: ['Node.js', 'Deno'] },
  { id: 'nextjs', name: 'Next.js', icon: '\u25B2', frameworks: ['App Router', 'Pages Router'] },
  { id: 'csharp', name: 'C#', icon: '\u{1F3AF}', frameworks: ['.NET'] },
  { id: 'ruby', name: 'Ruby', icon: '\u{1F48E}', frameworks: ['Rails', 'Generic'] },
];

// ------------------------------------------------------------------
// Route handlers
// ------------------------------------------------------------------

async function handleHealth(_req, res) {
  json(res, { ok: true, version: VERSION });
}

async function handleScanRepos(_req, res) {
  try {
    const repos = await scanRepos();
    json(res, { repos });
  } catch (err) {
    error(res, `Scan failed: ${err.message}`, 500);
  }
}

async function handleDetectLanguage(_req, res, body) {
  const { repoPath } = body || {};
  if (!repoPath) {
    return error(res, 'Missing repoPath in request body');
  }

  try {
    const result = detectLanguage(repoPath);
    json(res, result);
  } catch (err) {
    error(res, `Detection failed: ${err.message}`, 500);
  }
}

async function handleLanguages(_req, res) {
  json(res, { languages: LANGUAGES });
}

async function handleValidateLlm(_req, res, body) {
  const { provider, model, endpoint, apiKey } = body || {};

  if (!provider) {
    return error(res, 'Missing provider');
  }

  const start = Date.now();

  try {
    if (provider === 'local') {
      // Ollama — check /api/tags
      const ollamaUrl = (endpoint || 'http://localhost:11434') + '/api/tags';
      const resp = await httpRequest(ollamaUrl, { method: 'GET', timeout: 10000 });

      if (resp.status !== 200) {
        return json(res, { ok: false, error: `Ollama returned HTTP ${resp.status}` });
      }

      const data = JSON.parse(resp.body);
      const models = (data.models || []).map((m) => m.name || m.model);
      const modelBase = model ? model.split(':')[0] : null;

      // Check if the requested model is available
      if (model && !models.some((m) => m === model || m.startsWith(model + ':') || (modelBase && m.startsWith(modelBase)))) {
        return json(res, {
          ok: false,
          error: `Model "${model}" not found. Available: ${models.join(', ')}`,
          responseTimeMs: Date.now() - start,
        });
      }

      return json(res, { ok: true, responseTimeMs: Date.now() - start });
    }

    if (provider === 'anthropic') {
      if (!apiKey) {
        return json(res, { ok: false, error: 'Missing apiKey for Anthropic' });
      }
      // Validate key format: sk-ant-...
      if (!apiKey.startsWith('sk-ant-')) {
        return json(res, { ok: false, error: 'Invalid Anthropic API key format (expected sk-ant-...)' });
      }
      return json(res, { ok: true, responseTimeMs: Date.now() - start });
    }

    if (provider === 'openai') {
      if (!apiKey) {
        return json(res, { ok: false, error: 'Missing apiKey for OpenAI' });
      }
      if (!apiKey.startsWith('sk-')) {
        return json(res, { ok: false, error: 'Invalid OpenAI API key format (expected sk-...)' });
      }
      return json(res, { ok: true, responseTimeMs: Date.now() - start });
    }

    return error(res, `Unknown provider: ${provider}`);
  } catch (err) {
    return json(res, { ok: false, error: err.message, responseTimeMs: Date.now() - start });
  }
}

async function handleSaveConfig(_req, res, body) {
  if (!body || typeof body !== 'object') {
    return error(res, 'Missing config body');
  }

  try {
    // Build the YAML config structure
    const config = {};

    if (body.target || body.repoPath) config.target = body.target || body.repoPath;
    if (body.template) config.template = body.template;

    // Scoring section
    if (body.scoring) {
      config.scoring = {};
      if (body.scoring.hard_gate) config.scoring.hard_gate = body.scoring.hard_gate;
      if (body.scoring.weights) config.scoring.weights = body.scoring.weights;
      if (body.scoring.judge) config.scoring.judge = body.scoring.judge;
    }

    // Run section
    if (body.run) {
      config.run = body.run;
    }

    // Notifications section
    if (body.notifications) {
      config.notifications = body.notifications;
    }

    const yamlContent = '# Generated by autodev setup wizard\n' + yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });

    // Write to the target repo or to the autodev project directory
    const configDir = body.target || path.join(__dirname, '..');
    const configPath = path.join(configDir, 'autodev.yaml');

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, yamlContent, 'utf8');

    json(res, { configPath: configPath.replace(/\\/g, '/') });
  } catch (err) {
    error(res, `Failed to save config: ${err.message}`, 500);
  }
}

async function handleStartRun(_req, res, body) {
  const { configPath } = body || {};

  if (!configPath) {
    return error(res, 'Missing configPath');
  }

  // Verify the config file exists
  if (!fs.existsSync(configPath)) {
    return error(res, `Config file not found: ${configPath}`, 404);
  }

  // Generate a run ID based on the date
  const now = new Date();
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const runId = `${months[now.getMonth()]}${now.getDate()}${String.fromCharCode(97 + Math.floor(Math.random() * 26))}`;

  json(res, {
    runId,
    status: 'ready',
    configPath: configPath.replace(/\\/g, '/'),
  });
}

async function handleTestNotification(_req, res, body) {
  const { type, config } = body || {};

  if (!type) {
    return error(res, 'Missing notification type');
  }

  try {
    if (type === 'browser') {
      // Browser notifications are handled client-side
      return json(res, { ok: true });
    }

    if (type === 'email') {
      // Placeholder for email — MVP just returns success
      return json(res, { ok: true });
    }

    if (type === 'pushover') {
      const { token, user } = config || {};
      if (!token || !user) {
        return json(res, { ok: false, error: 'Missing pushover token or user key' });
      }

      const params = new URLSearchParams({
        token,
        user,
        title: 'autodev test',
        message: 'This is a test notification from autodev.',
      });

      const resp = await httpRequest('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
        body: params.toString(),
      });

      if (resp.status === 200) {
        return json(res, { ok: true });
      }

      const data = JSON.parse(resp.body);
      return json(res, { ok: false, error: data.errors ? data.errors.join(', ') : `HTTP ${resp.status}` });
    }

    return error(res, `Unknown notification type: ${type}`);
  } catch (err) {
    return json(res, { ok: false, error: err.message });
  }
}

// ------------------------------------------------------------------
// Browse Folder (native OS dialog)
// ------------------------------------------------------------------

/**
 * List directories inside a given path (for the in-browser folder picker).
 * GET /api/browse-folder?dir=C:/Users/me/dev
 * Returns { current, parent, dirs[] }
 */
async function handleBrowseFolder(req, res) {
  const os = await import('node:os');
  const url = new URL(req.url, 'http://localhost');
  let dir = url.searchParams.get('dir') || os.default.homedir();
  dir = dir.replace(/\\/g, '/');

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    const parent = path.dirname(dir).replace(/\\/g, '/');
    const isGitRepo = fs.existsSync(path.join(dir, '.git'));

    json(res, {
      current: dir,
      parent: parent !== dir ? parent : null,
      dirs,
      isGitRepo,
    });
  } catch (err) {
    error(res, `Cannot read directory: ${err.message}`, 400);
  }
}

// ------------------------------------------------------------------
// Agent handlers
// ------------------------------------------------------------------

async function handleAgentStart(_req, res, body) {
  if (experimentLoop && experimentLoop.status === 'running') {
    return error(res, 'An experiment loop is already running');
  }

  try {
    let config;

    // Try loading from file first
    try {
      const resolvedPath = body?.configPath || resolveConfigPath();
      config = loadConfig(resolvedPath);
    } catch {
      // No valid config file — build from request body with sensible defaults
      // Use template-based defaults for hard gate commands
      // Auto-detect hard gate commands from the target project
      let gates = ['echo "no gate configured"'];
      const repoPath = body?.repoPath || body?.target;
      if (repoPath) {
        gates = detectGatesFromRepo(repoPath);
      }

      config = {
        target: null,
        scoring: {
          hard_gate: gates,
          weights: { judge_score: 1.0 },
          judge: { default: { small: 'cloud', medium: 'cloud', large: 'cloud' }, cloud: { provider: 'anthropic', model: 'claude-sonnet-4-6' } },
        },
      };
    }

    // Merge body fields into config (wizard sends these directly)
    if (body?.repoPath) config.target = body.repoPath;
    if (body?.target) config.target = body.target;
    if (body?.template) config.template = body.template;
    if (body?.agent) config.agent = { ...config.agent, ...body.agent };
    if (body?.run) config.run = { ...config.run, ...body.run };
    if (body?.language) config.language = body.language;

    // Validate target exists
    if (!config.target) {
      return error(res, 'Missing target repository path. Select a repo in the wizard.');
    }

    experimentLoop = new ExperimentLoop(config);

    // Generate tag if not provided
    const now = new Date();
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const runTag = body?.tag || `${months[now.getMonth()]}${now.getDate()}${String.fromCharCode(97 + Math.floor(Math.random() * 26))}`;

    // Start in background (don't await)
    experimentLoop.start(runTag);

    json(res, {
      runId: runTag,
      branch: `autodev/${runTag}`,
      status: 'starting',
    });
  } catch (err) {
    error(res, `Failed to start agent: ${err.message}`, 500);
  }
}

async function handleAgentStop(_req, res) {
  if (!experimentLoop) {
    return error(res, 'No experiment loop is running');
  }

  experimentLoop.stop();
  json(res, { status: 'stopping' });
}

async function handleAgentStatus(_req, res) {
  if (!experimentLoop) {
    return json(res, { status: 'idle' });
  }

  json(res, experimentLoop.getStatus());
}

async function handleSSE(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  if (experimentLoop) {
    experimentLoop.events.addClient(res);

    // Send current status immediately
    const status = experimentLoop.getStatus();
    res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);
  }

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30_000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
}

async function handleDetectTools(_req, res) {
  try {
    const tools = await detectTools();

    // Separate docker from the rest
    const docker = tools.find((t) => t.name === 'docker') || { name: 'docker', available: false, version: null, path: null };
    const agentTools = tools.filter((t) => t.name !== 'docker');

    json(res, { docker, tools: agentTools });
  } catch (err) {
    error(res, `Tool detection failed: ${err.message}`, 500);
  }
}

async function handleGetExperiments(_req, res) {
  if (!experimentLoop) {
    return json(res, { experiments: [] });
  }

  json(res, { experiments: experimentLoop.experiments });
}

// ------------------------------------------------------------------
// Router
// ------------------------------------------------------------------

const routes = {
  'GET /api/health': handleHealth,
  'GET /api/scan-repos': handleScanRepos,
  'POST /api/detect-language': handleDetectLanguage,
  'GET /api/languages': handleLanguages,
  'POST /api/validate-llm': handleValidateLlm,
  'POST /api/save-config': handleSaveConfig,
  'POST /api/start-run': handleStartRun,
  'POST /api/test-notification': handleTestNotification,
  'GET /api/browse-folder': handleBrowseFolder,
  'POST /api/agent/start': handleAgentStart,
  'POST /api/agent/stop': handleAgentStop,
  'GET /api/agent/status': handleAgentStatus,
  'GET /api/sse': handleSSE,
  'GET /api/detect-tools': handleDetectTools,
  'GET /api/experiments': handleGetExperiments,
};

/**
 * Handle an incoming API request.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {object|null} body  Parsed JSON body (for POST/PUT requests)
 */
export async function handleApiRequest(req, res, body) {
  // Strip query string for route matching
  const urlPath = req.url.split('?')[0];
  const key = `${req.method} ${urlPath}`;

  const handler = routes[key];
  if (!handler) {
    return error(res, `Not found: ${req.method} ${urlPath}`, 404);
  }

  try {
    await handler(req, res, body);
  } catch (err) {
    console.error(`API error [${key}]:`, err);
    error(res, 'Internal server error', 500);
  }
}
