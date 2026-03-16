# autodev v0.3 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform autodev from a config wizard into a fully autonomous app development platform with live dashboard, container management, and visual capture.

**Architecture:** Four-phase build. Phase 1 (agent loop) is the foundation — it runs experiments autonomously. Phase 2 (SSE + dashboard) makes the loop visible. Phase 3 (containers) spins up kept experiments as running apps. Phase 4 (visual capture) screenshots and GIFs each kept experiment.

**Tech Stack:** Node.js (ESM), Next.js 15 (static export), Puppeteer, gif-encoder-2, SSE (native EventSource)

**Spec:** `docs/superpowers/specs/2026-03-16-agent-loop-dashboard-design.md`

---

## Phase 1: Agent Loop (Core Engine)

The experiment loop that proposes, applies, scores, and keeps/discards changes. This is the heart of autodev — everything else is UI on top.

---

### Task 1: Provider Interface + API Key Provider

**Files:**
- Create: `server/agent/providers/base.js`
- Create: `server/agent/providers/api-key.js`
- Create: `server/agent/providers/parse-response.js`
- Test: `tests/agent/parse-response.test.js`

- [ ] **Step 1: Write test for response parsing**

```javascript
// tests/agent/parse-response.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentResponse } from '../server/agent/providers/parse-response.js';

describe('parseAgentResponse', () => {
  it('parses clean JSON response', () => {
    const raw = JSON.stringify({
      description: 'Add input validation',
      category: 'quality',
      changes: [
        { path: 'src/foo.ts', action: 'modify', content: 'const x = 1;' }
      ]
    });
    const result = parseAgentResponse(raw);
    assert.equal(result.description, 'Add input validation');
    assert.equal(result.changes.length, 1);
    assert.equal(result.changes[0].path, 'src/foo.ts');
  });

  it('extracts JSON from mixed text output', () => {
    const raw = 'Thinking about the code...\n```json\n{"description":"fix","category":"quality","changes":[{"path":"a.js","action":"modify","content":"x"}]}\n```\nDone.';
    const result = parseAgentResponse(raw);
    assert.equal(result.description, 'fix');
    assert.equal(result.changes.length, 1);
  });

  it('returns null for unparseable output', () => {
    const result = parseAgentResponse('This is not JSON at all');
    assert.equal(result, null);
  });

  it('validates change objects have required fields', () => {
    const raw = JSON.stringify({
      description: 'test',
      category: 'quality',
      changes: [{ path: 'a.js' }]  // missing action and content
    });
    const result = parseAgentResponse(raw);
    assert.equal(result, null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/agent/parse-response.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement parse-response.js**

```javascript
// server/agent/providers/parse-response.js
// Parse LLM output into a structured { description, category, changes[] } object.
// Handles clean JSON, JSON in markdown code blocks, and JSON embedded in text.

const VALID_ACTIONS = new Set(['create', 'modify', 'delete']);

export function parseAgentResponse(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // Try 1: direct JSON.parse
  let parsed = tryParse(raw.trim());

  // Try 2: extract JSON from markdown code block
  if (!parsed) {
    const codeBlock = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlock) parsed = tryParse(codeBlock[1].trim());
  }

  // Try 3: find JSON object containing "changes" anywhere in text
  if (!parsed) {
    const jsonMatch = raw.match(/\{[\s\S]*?"changes"\s*:\s*\[[\s\S]*?\]\s*\}/);
    if (jsonMatch) parsed = tryParse(jsonMatch[0]);
  }

  if (!parsed) return null;

  // Validate structure
  if (!parsed.description || !Array.isArray(parsed.changes)) return null;
  if (parsed.changes.length === 0) return null;

  for (const change of parsed.changes) {
    if (!change.path || !VALID_ACTIONS.has(change.action)) return null;
    if (change.action !== 'delete' && typeof change.content !== 'string') return null;
  }

  return {
    description: String(parsed.description).slice(0, 200),
    category: String(parsed.category || 'quality'),
    changes: parsed.changes,
  };
}

function tryParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}
```

- [ ] **Step 4: Implement base.js (provider interface)**

```javascript
// server/agent/providers/base.js
// Base class for agent providers. All providers extend this.

export class AgentProvider {
  constructor(config) {
    this.config = config;
  }
  async propose(prompt) {
    throw new Error('propose() not implemented');
  }
  async test() {
    throw new Error('test() not implemented');
  }
}
```

- [ ] **Step 5: Implement api-key.js provider**

```javascript
// server/agent/providers/api-key.js
// Direct API calls to Anthropic or OpenAI.

import { AgentProvider } from './base.js';
import { parseAgentResponse } from './parse-response.js';

export class ApiKeyProvider extends AgentProvider {
  async propose(prompt) {
    const raw = this.config.provider === 'anthropic'
      ? await this._callAnthropic(prompt)
      : await this._callOpenAI(prompt);
    return parseAgentResponse(raw);
  }

  async test() {
    try {
      // Minimal API call to verify credentials
      if (this.config.provider === 'anthropic') {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: this.config.api_key });
        await client.messages.create({
          model: this.config.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        });
      }
      return { ok: true, message: 'Connected' };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  async _callAnthropic(prompt) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: this.config.api_key });
    const res = await client.messages.create({
      model: this.config.model || 'claude-sonnet-4-6',
      max_tokens: 16384,
      messages: [{ role: 'user', content: prompt }],
    });
    return res.content[0].text;
  }

  async _callOpenAI(prompt) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.api_key}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 16384,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }
}
```

- [ ] **Step 6: Run tests and verify they pass**

Run: `node --test tests/agent/parse-response.test.js`
Expected: 4 tests pass

- [ ] **Step 7: Commit**

```bash
git add server/agent/providers/ tests/agent/
git commit -m "feat: add provider interface, API key provider, and response parser"
```

---

### Task 2: Local CLI Provider + Tool Detection

**Files:**
- Create: `server/agent/providers/local-cli.js`
- Create: `server/agent/providers/local-llm.js`
- Create: `server/agent/detector.js`
- Test: `tests/agent/detector.test.js`

- [ ] **Step 1: Write test for CLI tool detection**

```javascript
// tests/agent/detector.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectTools } from '../server/agent/detector.js';

describe('detectTools', () => {
  it('returns an array of tool detection results', async () => {
    const tools = await detectTools();
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length > 0);
    for (const tool of tools) {
      assert.ok('name' in tool);
      assert.ok('available' in tool);
      assert.equal(typeof tool.available, 'boolean');
    }
  });

  it('detects docker availability', async () => {
    const tools = await detectTools();
    const docker = tools.find(t => t.name === 'docker');
    assert.ok(docker);
    assert.equal(typeof docker.available, 'boolean');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/agent/detector.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement detector.js**

```javascript
// server/agent/detector.js
// Detect installed CLI tools and Docker availability.

import { execSync } from 'node:child_process';

const TOOLS = [
  { name: 'claude', versionCmd: 'claude --version' },
  { name: 'codex', versionCmd: 'codex --version' },
  { name: 'gemini', versionCmd: 'gemini --version' },
  { name: 'opencode', versionCmd: 'opencode --version' },
  { name: 'pi', versionCmd: 'pi --version' },
  { name: 'docker', versionCmd: 'docker --version' },
];

function tryExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function findPath(name) {
  const cmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
  const result = tryExec(cmd);
  return result ? result.split('\n')[0].trim() : null;
}

export async function detectTools() {
  return TOOLS.map(({ name, versionCmd }) => {
    const versionOutput = tryExec(versionCmd);
    const toolPath = versionOutput ? findPath(name) : null;
    const version = versionOutput
      ? (versionOutput.match(/(\d+\.\d+[\.\d]*)/)?.[1] || versionOutput.slice(0, 50))
      : null;
    return {
      name,
      available: !!versionOutput,
      version,
      path: toolPath?.replace(/\\/g, '/') || null,
    };
  });
}
```

- [ ] **Step 4: Implement local-cli.js provider**

```javascript
// server/agent/providers/local-cli.js
// Spawn a local CLI tool (claude, codex, gemini, etc.) as a subprocess.

import { spawn } from 'node:child_process';
import { AgentProvider } from './base.js';
import { parseAgentResponse } from './parse-response.js';

export class LocalCliProvider extends AgentProvider {
  async propose(prompt) {
    const raw = await this._runCli(prompt);
    return parseAgentResponse(raw);
  }

  async test() {
    try {
      const toolPath = this.config.path || this.config.tool;
      const result = await this._exec(toolPath, ['--version']);
      return { ok: true, message: result.slice(0, 100) };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  _runCli(prompt) {
    const toolPath = this.config.path || this.config.tool;
    // Most CLI tools accept -p for print mode with stdin prompt
    return new Promise((resolve, reject) => {
      const child = spawn(toolPath, ['-p', prompt], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: (this.config.timeout || 300) * 1000,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', d => { stdout += d; });
      child.stderr.on('data', d => { stderr += d; });
      child.on('close', code => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`CLI exited ${code}: ${stderr.slice(0, 200)}`));
      });
      child.on('error', reject);
    });
  }

  _exec(cmd, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 });
      let out = '';
      child.stdout.on('data', d => { out += d; });
      child.on('close', () => resolve(out.trim()));
      child.on('error', reject);
    });
  }
}
```

- [ ] **Step 5: Implement local-llm.js provider**

```javascript
// server/agent/providers/local-llm.js
// HTTP calls to local inference servers (Ollama, LM Studio, etc.)

import http from 'node:http';
import { AgentProvider } from './base.js';
import { parseAgentResponse } from './parse-response.js';

export class LocalLlmProvider extends AgentProvider {
  async propose(prompt) {
    const raw = await this._call(prompt);
    return parseAgentResponse(raw);
  }

  async test() {
    try {
      const url = new URL('/api/tags', this.config.endpoint || 'http://localhost:11434');
      const res = await fetch(url.href);
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      return { ok: true, message: 'Connected to Ollama' };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  async _call(prompt) {
    const url = new URL('/api/generate', this.config.endpoint || 'http://localhost:11434');
    const body = JSON.stringify({
      model: this.config.model || 'qwen3:4b',
      prompt,
      stream: false,
      format: 'json',
    });

    return new Promise((resolve, reject) => {
      const req = http.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: (this.config.timeout || 120) * 1000,
      }, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.response || data);
          } catch {
            resolve(data);
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
      req.write(body);
      req.end();
    });
  }
}
```

- [ ] **Step 6: Run tests and verify they pass**

Run: `node --test tests/agent/detector.test.js`
Expected: 2 tests pass

- [ ] **Step 7: Commit**

```bash
git add server/agent/providers/local-cli.js server/agent/providers/local-llm.js server/agent/detector.js tests/agent/
git commit -m "feat: add local CLI provider, local LLM provider, and tool detector"
```

---

### Task 3: Prompt Builder

**Files:**
- Create: `server/agent/prompt.js`
- Test: `tests/agent/prompt.test.js`

- [ ] **Step 1: Write test for prompt builder**

```javascript
// tests/agent/prompt.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from '../server/agent/prompt.js';

describe('buildPrompt', () => {
  it('builds a prompt with all four sections', () => {
    const prompt = buildPrompt({
      projectName: 'myapp',
      language: 'typescript',
      framework: 'Next.js',
      tree: 'src/\n  app/\n  components/',
      keyFiles: [{ path: 'src/app/page.tsx', content: 'export default function Home() {}' }],
      history: [
        { experiment: 1, composite: 78.0, status: 'keep', description: 'baseline' },
      ],
      metrics: { coverage: 78.4, typeErrors: 0, bundleKb: 284 },
      aggressiveness: 'balanced',
      creativity: 'moderate',
    });

    assert.ok(prompt.includes('myapp'));
    assert.ok(prompt.includes('typescript'));
    assert.ok(prompt.includes('"changes"'));
    assert.ok(prompt.includes('78.4'));
    assert.ok(prompt.includes('baseline'));
  });

  it('adjusts instruction based on aggressiveness', () => {
    const conservative = buildPrompt({
      projectName: 'app', language: 'python', framework: 'Python',
      tree: '', keyFiles: [], history: [], metrics: {},
      aggressiveness: 'conservative', creativity: 'safe',
    });
    assert.ok(conservative.includes('small'));

    const aggressive = buildPrompt({
      projectName: 'app', language: 'python', framework: 'Python',
      tree: '', keyFiles: [], history: [], metrics: {},
      aggressiveness: 'aggressive', creativity: 'experimental',
    });
    assert.ok(aggressive.includes('ambitious'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/agent/prompt.test.js`
Expected: FAIL

- [ ] **Step 3: Implement prompt.js**

```javascript
// server/agent/prompt.js
// Build structured prompts for the agent LLM.

const SYSTEM = `You are an autonomous app development agent. Your job is to improve a codebase one experiment at a time. Each experiment should be a focused, targeted change.

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "description": "one-line summary of what you changed",
  "category": "quality|feature|refactor|test|performance",
  "changes": [
    { "path": "relative/path/to/file.ts", "action": "create|modify|delete", "content": "full file content here" }
  ]
}

Rules:
- Each change must include the COMPLETE file content (not a diff)
- For delete actions, set content to null
- Limit changes to 1-5 files per experiment
- Never modify config files, lock files, or .gitignore`;

const AGGRESSIVENESS_PROMPTS = {
  conservative: 'Propose a small, safe improvement. Prefer: fixing lint warnings, adding missing tests, removing dead code, simplifying logic. Avoid anything that could break existing functionality.',
  balanced: 'Propose a focused improvement. Prefer: test coverage gaps, small refactors, input validation, error handling. Avoid: large rewrites or new dependencies.',
  aggressive: 'Propose an ambitious improvement. You can add new features, restructure modules, or make significant refactors. Take calculated risks for meaningful gains.',
};

const CREATIVITY_PROMPTS = {
  safe: 'Use only proven, conventional patterns. No novel approaches.',
  moderate: 'You may use creative approaches if they clearly improve the code.',
  experimental: 'Try novel solutions and unconventional approaches. Push boundaries.',
};

export function buildPrompt({ projectName, language, framework, tree, keyFiles, history, metrics, aggressiveness, creativity }) {
  let prompt = SYSTEM + '\n\n';

  // Context section
  prompt += `## Project Context\n`;
  prompt += `Project: ${projectName} (${language}/${framework})\n\n`;
  if (tree) {
    prompt += `### Directory Structure\n\`\`\`\n${tree}\n\`\`\`\n\n`;
  }
  if (keyFiles && keyFiles.length > 0) {
    prompt += `### Key Source Files\n`;
    for (const file of keyFiles) {
      prompt += `\n**${file.path}**\n\`\`\`\n${file.content}\n\`\`\`\n`;
    }
    prompt += '\n';
  }

  // Scoring history
  if (history && history.length > 0) {
    prompt += `## Scoring History (last ${history.length} experiments)\n`;
    for (const h of history) {
      prompt += `#${h.experiment} ${h.composite} ${h.status.toUpperCase()} "${h.description}"\n`;
    }
    prompt += '\n';
  }

  // Current metrics
  if (metrics && Object.keys(metrics).length > 0) {
    prompt += `## Current Metrics\n`;
    for (const [key, value] of Object.entries(metrics)) {
      if (value !== undefined && value !== null) {
        prompt += `- ${key}: ${value}\n`;
      }
    }
    prompt += '\n';
  }

  // Instruction
  prompt += `## Your Task\n`;
  prompt += (AGGRESSIVENESS_PROMPTS[aggressiveness] || AGGRESSIVENESS_PROMPTS.balanced) + '\n';
  prompt += (CREATIVITY_PROMPTS[creativity] || CREATIVITY_PROMPTS.moderate) + '\n';
  prompt += '\nAll else being equal, simpler is better. A small improvement from deleting code is better than a large improvement from adding complexity.\n';

  return prompt;
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `node --test tests/agent/prompt.test.js`
Expected: 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add server/agent/prompt.js tests/agent/prompt.test.js
git commit -m "feat: add prompt builder for agent LLM"
```

---

### Task 4: Apply + Revert (File Changes and Git Operations)

**Files:**
- Create: `server/agent/apply.js`
- Test: `tests/agent/apply.test.js`

- [ ] **Step 1: Write test for apply and revert**

```javascript
// tests/agent/apply.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { applyChanges, revertLastCommit } from '../server/agent/apply.js';

describe('applyChanges', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autodev-test-'));
    execSync('git init', { cwd: tmpDir });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir });
    execSync('git config user.name "Test"', { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, 'existing.txt'), 'original');
    execSync('git add -A && git commit -m "init"', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates new files', () => {
    applyChanges(tmpDir, [
      { path: 'src/new.js', action: 'create', content: 'console.log("hello")' }
    ], 'add new file');
    assert.ok(fs.existsSync(path.join(tmpDir, 'src', 'new.js')));
    assert.equal(fs.readFileSync(path.join(tmpDir, 'src', 'new.js'), 'utf8'), 'console.log("hello")');
  });

  it('modifies existing files', () => {
    applyChanges(tmpDir, [
      { path: 'existing.txt', action: 'modify', content: 'modified' }
    ], 'modify file');
    assert.equal(fs.readFileSync(path.join(tmpDir, 'existing.txt'), 'utf8'), 'modified');
  });

  it('deletes files', () => {
    applyChanges(tmpDir, [
      { path: 'existing.txt', action: 'delete', content: null }
    ], 'delete file');
    assert.ok(!fs.existsSync(path.join(tmpDir, 'existing.txt')));
  });

  it('commits changes to git', () => {
    applyChanges(tmpDir, [
      { path: 'new.js', action: 'create', content: 'x' }
    ], 'test commit');
    const log = execSync('git log --oneline', { cwd: tmpDir, encoding: 'utf8' });
    assert.ok(log.includes('experiment: test commit'));
  });
});

describe('revertLastCommit', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autodev-test-'));
    execSync('git init', { cwd: tmpDir });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir });
    execSync('git config user.name "Test"', { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'original');
    execSync('git add -A && git commit -m "init"', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reverts the last commit', () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'changed');
    execSync('git add -A && git commit -m "change"', { cwd: tmpDir });
    revertLastCommit(tmpDir);
    assert.equal(fs.readFileSync(path.join(tmpDir, 'file.txt'), 'utf8'), 'original');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/agent/apply.test.js`
Expected: FAIL

- [ ] **Step 3: Implement apply.js**

```javascript
// server/agent/apply.js
// Apply file changes from agent output and manage git commits.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export function applyChanges(worktreePath, changes, description) {
  for (const change of changes) {
    const fullPath = path.join(worktreePath, change.path);

    switch (change.action) {
      case 'create':
      case 'modify':
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, change.content, 'utf-8');
        break;
      case 'delete':
        try { fs.unlinkSync(fullPath); } catch { /* file may not exist */ }
        break;
    }
  }

  execSync('git add -A', { cwd: worktreePath, encoding: 'utf-8' });
  execSync(`git commit -m "experiment: ${description.replace(/"/g, '\\"')}"`, {
    cwd: worktreePath,
    encoding: 'utf-8',
  });
}

export function revertLastCommit(worktreePath) {
  execSync('git reset --hard HEAD~1', { cwd: worktreePath, encoding: 'utf-8' });
}

export function getCurrentCommit(worktreePath) {
  return execSync('git rev-parse --short HEAD', {
    cwd: worktreePath,
    encoding: 'utf-8',
  }).trim();
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `node --test tests/agent/apply.test.js`
Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add server/agent/apply.js tests/agent/apply.test.js
git commit -m "feat: add file change applicator with git commit/revert"
```

---

### Task 5: SSE Event Emitter

**Files:**
- Create: `server/agent/events.js`
- Test: `tests/agent/events.test.js`

- [ ] **Step 1: Write test for SSE event emitter**

```javascript
// tests/agent/events.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AgentEvents } from '../server/agent/events.js';

describe('AgentEvents', () => {
  it('emits and receives events', () => {
    const events = new AgentEvents();
    const received = [];
    events.on('status', data => received.push(data));
    events.emitStatus({ phase: 'analyzing', experiment: 1 });
    assert.equal(received.length, 1);
    assert.equal(received[0].phase, 'analyzing');
  });

  it('formats SSE messages correctly', () => {
    const events = new AgentEvents();
    const msg = events.formatSSE('score', { composite: 84.1 });
    assert.ok(msg.startsWith('event: score\n'));
    assert.ok(msg.includes('"composite":84.1'));
    assert.ok(msg.endsWith('\n\n'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/agent/events.test.js`
Expected: FAIL

- [ ] **Step 3: Implement events.js**

```javascript
// server/agent/events.js
// SSE event emitter for live dashboard updates.

import { EventEmitter } from 'node:events';

export class AgentEvents extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
  }

  addClient(res) {
    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
  }

  broadcast(eventType, data) {
    const msg = this.formatSSE(eventType, data);
    for (const client of this.clients) {
      try { client.write(msg); } catch { this.clients.delete(client); }
    }
    this.emit(eventType, data);
  }

  formatSSE(eventType, data) {
    return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  emitStatus(data) { this.broadcast('status', data); }
  emitScore(data) { this.broadcast('score', data); }
  emitMetrics(data) { this.broadcast('metrics', data); }
  emitLog(line) { this.broadcast('log', { line, timestamp: new Date().toISOString() }); }
  emitExperimentComplete(data) { this.broadcast('experiment_complete', data); }
  emitStats(data) { this.broadcast('stats', data); }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `node --test tests/agent/events.test.js`
Expected: 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add server/agent/events.js tests/agent/events.test.js
git commit -m "feat: add SSE event emitter for live dashboard"
```

---

### Task 6: Main Experiment Loop

**Files:**
- Create: `server/agent/loop.js`
- Modify: `server/api.js` — add agent/start, agent/stop, agent/status, sse, detect-tools endpoints

- [ ] **Step 1: Implement loop.js**

This is the core experiment loop. It orchestrates: worktree setup → baseline → loop (prompt → propose → apply → score → decide → emit).

```javascript
// server/agent/loop.js
// Main experiment loop controller.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { buildPrompt } from './prompt.js';
import { applyChanges, revertLastCommit, getCurrentCommit } from './apply.js';
import { AgentEvents } from './events.js';
import { ApiKeyProvider } from './providers/api-key.js';
import { LocalCliProvider } from './providers/local-cli.js';
import { LocalLlmProvider } from './providers/local-llm.js';

export class ExperimentLoop {
  constructor(config) {
    this.config = config;
    this.events = new AgentEvents();
    this.status = 'idle';  // idle | running | stopping | stopped
    this.runId = null;
    this.worktreePath = null;
    this.experimentCount = 0;
    this.kept = 0;
    this.discarded = 0;
    this.crashed = 0;
    this.startTime = null;
    this.currentPhase = null;
    this.latestScore = null;
    this.baselineScore = null;
    this.provider = null;
    this.experiments = [];
  }

  createProvider() {
    const agentConfig = this.config.agent || {};
    switch (agentConfig.type) {
      case 'local-cli': return new LocalCliProvider(agentConfig);
      case 'local-inference': return new LocalLlmProvider(agentConfig);
      case 'api-key':
      default: return new ApiKeyProvider(agentConfig);
    }
  }

  async start(tag) {
    if (this.status === 'running') throw new Error('Already running');

    this.runId = tag || `run-${Date.now()}`;
    this.status = 'running';
    this.startTime = Date.now();
    this.experimentCount = 0;
    this.kept = 0;
    this.discarded = 0;
    this.crashed = 0;
    this.experiments = [];
    this.provider = this.createProvider();

    const targetDir = this.config.target;
    const branch = `autodev/${this.runId}`;
    this.worktreePath = path.join(targetDir, '.autodev-work');

    try {
      // Create branch and worktree
      this.events.emitLog('Setting up worktree...');
      try { execSync(`git branch ${branch}`, { cwd: targetDir, encoding: 'utf8' }); } catch { /* branch may exist */ }
      try { execSync(`git worktree remove .autodev-work --force`, { cwd: targetDir, encoding: 'utf8' }); } catch { /* may not exist */ }
      execSync(`git worktree add .autodev-work ${branch}`, { cwd: targetDir, encoding: 'utf8' });

      this.events.emitLog('Running baseline score...');
      await this._runLoop();
    } catch (err) {
      this.events.emitLog(`Fatal error: ${err.message}`);
      this.status = 'stopped';
    } finally {
      // Cleanup worktree
      try { execSync(`git worktree remove .autodev-work --force`, { cwd: targetDir, encoding: 'utf8' }); } catch { /* ignore */ }
      this.status = 'stopped';
      this.events.emitStats(this.getStats());
    }
  }

  stop() {
    if (this.status === 'running') {
      this.status = 'stopping';
      this.events.emitLog('Stopping after current experiment...');
    }
  }

  getStatus() {
    return {
      status: this.status,
      runId: this.runId,
      currentExperiment: this.experimentCount,
      phase: this.currentPhase,
      stats: this.getStats(),
      latestScore: this.latestScore,
      baselineScore: this.baselineScore,
    };
  }

  getStats() {
    const elapsed = this.startTime ? Date.now() - this.startTime : 0;
    const maxExp = this.config.run?.max_experiments || this.config.run?.maxExperiments;
    const remaining = maxExp && this.experimentCount > 0
      ? Math.round(((maxExp - this.experimentCount) / this.experimentCount) * elapsed)
      : null;

    return {
      total: this.experimentCount,
      kept: this.kept,
      discarded: this.discarded,
      crashed: this.crashed,
      elapsed: formatDuration(elapsed),
      remaining: remaining ? `~${formatDuration(remaining)}` : 'unknown',
    };
  }

  async _runLoop() {
    const maxExperiments = this.config.run?.max_experiments || this.config.run?.maxExperiments || Infinity;

    while (this.status === 'running' && this.experimentCount < maxExperiments) {
      this.experimentCount++;
      this.events.emitStats(this.getStats());

      try {
        await this._runExperiment();
      } catch (err) {
        this.crashed++;
        this.events.emitLog(`Experiment #${this.experimentCount} crashed: ${err.message}`);
        this.events.emitExperimentComplete({
          id: `exp-${String(this.experimentCount).padStart(3, '0')}`,
          experiment: this.experimentCount,
          status: 'crash',
          composite: 0,
          summary: err.message.slice(0, 100),
        });
        try { revertLastCommit(this.worktreePath); } catch { /* nothing to revert */ }
      }

      // Check stop flag
      if (this.status === 'stopping') {
        this.events.emitLog('Stopped by user.');
        break;
      }
    }

    if (this.experimentCount >= maxExperiments) {
      this.events.emitLog(`Reached experiment limit (${maxExperiments}).`);
    }
  }

  async _runExperiment() {
    const cwd = this.worktreePath;

    // Phase 1: Analyze + build prompt
    this.currentPhase = 'analyzing';
    this.events.emitStatus({ phase: 'analyzing', experiment: this.experimentCount });
    this.events.emitLog(`Experiment #${this.experimentCount}: Analyzing codebase...`);

    const tree = this._getTree(cwd);
    const keyFiles = this._getKeyFiles(cwd);
    const history = this.experiments.slice(-10);
    const metrics = this._getCurrentMetrics();

    const prompt = buildPrompt({
      projectName: path.basename(this.config.target),
      language: this.config.template || 'generic',
      framework: this.config.template || 'generic',
      tree,
      keyFiles,
      history,
      metrics,
      aggressiveness: this.config.run?.aggressiveness || 'balanced',
      creativity: this.config.run?.creativity || 'moderate',
    });

    // Phase 2: Propose changes
    this.currentPhase = 'proposing';
    this.events.emitStatus({ phase: 'proposing', experiment: this.experimentCount });
    this.events.emitLog('Proposing changes...');

    const proposal = await this.provider.propose(prompt);
    if (!proposal) {
      throw new Error('Agent returned unparseable response');
    }

    this.events.emitLog(`Proposed: "${proposal.description}" (${proposal.changes.length} files)`);

    // Phase 3: Apply changes
    this.currentPhase = 'applying';
    this.events.emitStatus({ phase: 'applying', experiment: this.experimentCount });
    applyChanges(cwd, proposal.changes, proposal.description);
    const commit = getCurrentCommit(cwd);

    // Phase 4: Score
    this.currentPhase = 'scoring';
    this.events.emitStatus({ phase: 'scoring', experiment: this.experimentCount });
    this.events.emitLog('Running autodev-score...');

    const scoreResult = this._runScore(cwd);

    // Phase 5: Decide
    this.currentPhase = 'deciding';
    this.events.emitStatus({ phase: 'deciding', experiment: this.experimentCount });

    const composite = scoreResult.composite;
    const previousScore = this.latestScore ?? this.baselineScore;

    if (this.baselineScore === null) {
      this.baselineScore = composite;
    }

    let verdict;
    if (!scoreResult.passed) {
      verdict = 'crash';
      this.crashed++;
      revertLastCommit(cwd);
      this.events.emitLog(`CRASH: Gate failed — ${scoreResult.error}`);
    } else if (previousScore === null || composite >= previousScore) {
      verdict = 'keep';
      this.kept++;
      this.latestScore = composite;
      this.events.emitLog(`KEEP: ${previousScore ?? '—'} → ${composite} (+${(composite - (previousScore || 0)).toFixed(1)})`);
    } else {
      verdict = 'discard';
      this.discarded++;
      revertLastCommit(cwd);
      this.events.emitLog(`DISCARD: ${composite} < ${previousScore}`);
    }

    const experiment = {
      id: `exp-${String(this.experimentCount).padStart(3, '0')}`,
      experiment: this.experimentCount,
      commit,
      composite,
      status: verdict,
      description: proposal.description,
      category: proposal.category,
      metrics: scoreResult.metrics || {},
      timestamp: new Date().toISOString(),
    };

    this.experiments.push(experiment);

    this.events.emitScore({
      experiment: this.experimentCount,
      composite,
      previous: previousScore,
      verdict: verdict.toUpperCase(),
      summary: proposal.description,
    });
    this.events.emitMetrics(scoreResult.metrics || {});
    this.events.emitExperimentComplete(experiment);
    this.events.emitStats(this.getStats());
  }

  _runScore(cwd) {
    try {
      const output = execSync('node bin/score.js --no-judge', {
        cwd: path.resolve(path.dirname(cwd), '..'), // autodev root
        encoding: 'utf-8',
        timeout: 300_000,
        env: { ...process.env, AUTODEV_TARGET: cwd },
      });

      const composite = parseFloat(output.match(/composite_score:\s*([\d.]+)/)?.[1] || '0');
      const gate = output.includes('gate:') && output.includes('PASS');
      const error = output.match(/gate_error:\s*(.+)/)?.[1] || null;

      return { passed: gate, composite, error, metrics: {} };
    } catch (err) {
      return { passed: false, composite: 0, error: err.message.slice(0, 200), metrics: {} };
    }
  }

  _getTree(cwd) {
    try {
      return execSync('find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" | head -50', {
        cwd, encoding: 'utf-8', timeout: 5000,
      }).trim();
    } catch {
      return '';
    }
  }

  _getKeyFiles(cwd) {
    const candidates = ['README.md', 'package.json', 'src/app/page.tsx', 'src/index.ts', 'main.py', 'Cargo.toml'];
    const files = [];
    for (const candidate of candidates) {
      const fullPath = path.join(cwd, candidate);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.length < 10000) {
            files.push({ path: candidate, content });
          }
        } catch { /* skip */ }
      }
      if (files.length >= 5) break;
    }
    return files;
  }

  _getCurrentMetrics() {
    const last = this.experiments.filter(e => e.status === 'keep').pop();
    return last?.metrics || {};
  }
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
```

- [ ] **Step 2: Add API endpoints to server/api.js**

Add to the imports at top of `server/api.js`:
```javascript
import { ExperimentLoop } from './agent/loop.js';
import { detectTools } from './agent/detector.js';
```

Add a singleton loop instance and handlers:
```javascript
let experimentLoop = null;

async function handleAgentStart(req, res, body) {
  if (experimentLoop?.status === 'running') {
    return error(res, 'Agent is already running');
  }
  const configPath = resolveConfigPath(body?.configPath);
  const config = loadConfig(configPath);
  experimentLoop = new ExperimentLoop(config);
  const tag = body?.tag || `run-${Date.now()}`;

  // Start loop in background (don't await)
  experimentLoop.start(tag).catch(err => {
    console.error('Loop error:', err);
  });

  json(res, {
    runId: tag,
    branch: `autodev/${tag}`,
    worktree: path.join(config.target, '.autodev-work'),
    status: 'starting',
  });
}

function handleAgentStop(req, res) {
  if (!experimentLoop) return error(res, 'No agent running');
  experimentLoop.stop();
  json(res, { status: 'stopping', message: 'Will stop after current experiment completes' });
}

function handleAgentStatus(req, res) {
  if (!experimentLoop) return json(res, { status: 'idle' });
  json(res, experimentLoop.getStatus());
}

function handleSSE(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    ...CORS_HEADERS,
  });
  res.write('event: connected\ndata: {}\n\n');

  if (experimentLoop) {
    experimentLoop.events.addClient(res);
  }

  req.on('close', () => {
    if (experimentLoop) {
      experimentLoop.events.clients.delete(res);
    }
  });
}

async function handleDetectTools(req, res) {
  const tools = await detectTools();
  const docker = tools.find(t => t.name === 'docker');
  json(res, {
    docker: docker ? { available: docker.available, version: docker.version } : { available: false },
    tools: tools.filter(t => t.name !== 'docker'),
  });
}

async function handleGetExperiments(req, res) {
  if (!experimentLoop) return json(res, { experiments: [] });
  json(res, { experiments: experimentLoop.experiments });
}
```

Add to the routes object:
```javascript
'POST /api/agent/start': handleAgentStart,
'POST /api/agent/stop': handleAgentStop,
'GET /api/agent/status': handleAgentStatus,
'GET /api/sse': handleSSE,
'GET /api/detect-tools': handleDetectTools,
'GET /api/experiments': handleGetExperiments,
```

- [ ] **Step 3: Commit**

```bash
git add server/agent/loop.js server/api.js
git commit -m "feat: add experiment loop controller and agent API endpoints"
```

---

## Phase 2: Live Dashboard (Frontend)

Build the real-time dashboard that connects to the SSE stream and displays experiment progress.

---

### Task 7: SSE Client Hook + Dashboard Page

**Files:**
- Create: `web/src/lib/sse.ts`
- Create: `web/src/app/dashboard/page.tsx`
- Create: `web/src/components/Dashboard.tsx`

- [ ] **Step 1: Create SSE client hook**

```typescript
// web/src/lib/sse.ts
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface SSEEvent {
  type: string;
  data: unknown;
}

export function useSSE(url: string) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());

  const on = useCallback((eventType: string, handler: (data: unknown) => void) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType)!.add(handler);
    return () => { listenersRef.current.get(eventType)?.delete(handler); };
  }, []);

  useEffect(() => {
    const es = new EventSource(url);

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const eventTypes = ['status', 'score', 'metrics', 'log', 'experiment_complete', 'stats', 'connected'];
    for (const type of eventTypes) {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setLastEvent({ type, data });
          const handlers = listenersRef.current.get(type);
          if (handlers) {
            for (const handler of handlers) handler(data);
          }
        } catch { /* ignore parse errors */ }
      });
    }

    return () => es.close();
  }, [url]);

  return { connected, lastEvent, on };
}
```

- [ ] **Step 2: Create dashboard page and container component**

These are large UI components — create them with all six panels (StatusBar, ScoreChart, MetricsPanel, StatsPanel, ExperimentLog, AgentOutput). Each panel is a separate component file.

Create all dashboard component files per the spec (Section 5.2). Each component receives data via props passed down from Dashboard.tsx which manages state from SSE events.

- [ ] **Step 3: Build and verify**

```bash
cd web && ./node_modules/.bin/next build
```
Expected: Build succeeds with `/dashboard` route

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/sse.ts web/src/app/dashboard/ web/src/components/Dashboard.tsx web/src/components/StatusBar.tsx web/src/components/ScoreChart.tsx web/src/components/MetricsPanel.tsx web/src/components/StatsPanel.tsx web/src/components/ExperimentLog.tsx web/src/components/AgentOutput.tsx
git commit -m "feat: add live dashboard with SSE-powered panels"
```

---

### Task 8: Wizard Step 3 Redesign — Provider Chooser

**Files:**
- Modify: `web/src/components/steps/LlmConfig.tsx` → rewrite as provider chooser
- Modify: `web/src/components/Wizard.tsx` → update config model
- Modify: `web/src/lib/types.ts` → update types
- Modify: `web/src/lib/api.ts` → add detect-tools endpoint

- [ ] **Step 1: Update types.ts with new provider model**

Replace `LlmConfig` with `AgentConfig`:

```typescript
export interface AgentConfig {
  type: 'api-key' | 'oauth' | 'local-cli' | 'local-inference';
  provider?: string;
  model?: string;
  apiKey?: string;
  tool?: string;
  toolPath?: string;
  endpoint?: string;
}
```

- [ ] **Step 2: Rewrite LlmConfig.tsx as ProviderConfig.tsx**

Four-card selector (API Key, OAuth, Local CLI, Local Inference). Local CLI card calls `GET /api/detect-tools` and shows detected tools with versions. Each card expands its own config panel.

- [ ] **Step 3: Update Wizard.tsx to use new config model and redirect to /dashboard on launch**

- [ ] **Step 4: Build and verify**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: redesign wizard step 3 as provider chooser with CLI detection"
```

---

## Phase 3: Container Management

Spin up kept experiments as running apps.

---

### Task 9: Port Allocator + Container/Process Manager

**Files:**
- Create: `server/containers/ports.js`
- Create: `server/containers/manager.js`
- Create: `server/containers/docker.js`
- Create: `server/containers/process.js`
- Test: `tests/containers/ports.test.js`

- [ ] **Step 1: Write test for port allocator**

```javascript
// tests/containers/ports.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PortAllocator } from '../server/containers/ports.js';

describe('PortAllocator', () => {
  it('allocates sequential ports from base', () => {
    const alloc = new PortAllocator(3401);
    assert.equal(alloc.next(), 3401);
    assert.equal(alloc.next(), 3402);
    assert.equal(alloc.next(), 3403);
  });

  it('tracks active ports', () => {
    const alloc = new PortAllocator(3401);
    alloc.next(); alloc.next();
    assert.equal(alloc.activeCount(), 2);
    alloc.release(3401);
    assert.equal(alloc.activeCount(), 1);
  });
});
```

- [ ] **Step 2: Implement ports.js, manager.js, docker.js, process.js**

Port allocator: monotonically increasing, tracks active set.
Manager: decides Docker vs process, delegates to the appropriate module, tracks containers per experiment.
Docker: `docker build`, `docker run`, `docker rm`.
Process: `spawn(appCommand)`, track child PID, kill on cleanup.

- [ ] **Step 3: Integrate with loop.js — after KEEP, copy build context and start container**

- [ ] **Step 4: Add API endpoints: `GET /api/experiments`, `POST /api/containers/:id/stop`, `GET /api/artifacts/:id/:file`**

- [ ] **Step 5: Run tests and commit**

```bash
git commit -m "feat: add container/process manager with port allocation"
```

---

## Phase 4: Visual Capture

Screenshot + GIF recording for each kept experiment.

---

### Task 10: Screenshot Capture

**Files:**
- Create: `server/capture/screenshot.js`

- [ ] **Step 1: Install puppeteer**

```bash
npm install puppeteer
```

- [ ] **Step 2: Implement screenshot.js**

Launch headless browser, navigate to `localhost:{port}`, wait for networkidle, screenshot to `.autodev-artifacts/exp-{id}/screenshot.png`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add Puppeteer screenshot capture for kept experiments"
```

---

### Task 11: GIF Recorder + Smart Interaction

**Files:**
- Create: `server/capture/recorder.js`
- Create: `server/capture/interaction.js`

- [ ] **Step 1: Install gif-encoder-2**

```bash
npm install gif-encoder-2 pngjs
```

- [ ] **Step 2: Implement recorder.js**

Capture frames at 5fps for 8 seconds, encode to GIF. Input: Puppeteer page instance. Output: GIF buffer written to `.autodev-artifacts/exp-{id}/recording.gif`.

- [ ] **Step 3: Implement interaction.js**

Ask the agent provider (if not Local CLI): "Given this page's HTML, what 2-3 interactions showcase it?" Parse response as `[{action, selector?, page?, value?}]`. Execute with Puppeteer. Fallback: slow scroll top-to-bottom.

- [ ] **Step 4: Integrate capture pipeline into container manager — after health check passes, run screenshot + GIF**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add GIF recorder with LLM-guided smart interaction"
```

---

### Task 12: Experiment Gallery UI

**Files:**
- Create: `web/src/components/ExperimentDetail.tsx`
- Create: `web/src/components/ExperimentGallery.tsx`
- Modify: `web/src/components/ExperimentLog.tsx` — add click-to-expand

- [ ] **Step 1: Build ExperimentDetail component**

Shows screenshot, auto-playing GIF, metrics breakdown, and iframe for the live app. Uses `GET /api/artifacts/:id/screenshot.png` and `GET /api/artifacts/:id/recording.gif`.

- [ ] **Step 2: Build ExperimentGallery component**

Grid of kept experiment thumbnails. Click opens ExperimentDetail.

- [ ] **Step 3: Wire into Dashboard — clicking an experiment in the log opens the detail panel**

- [ ] **Step 4: Build, verify, commit**

```bash
git commit -m "feat: add experiment gallery with screenshots, GIFs, and live app iframe"
```

---

## Final: Integration Test

- [ ] **Step 1: Start autodev server**
- [ ] **Step 2: Navigate wizard → configure API key provider → launch**
- [ ] **Step 3: Verify dashboard shows live updates**
- [ ] **Step 4: Verify kept experiments get containers + screenshots + GIFs**
- [ ] **Step 5: Verify experiment gallery shows visual artifacts**
- [ ] **Step 6: Click Stop and verify graceful shutdown**
