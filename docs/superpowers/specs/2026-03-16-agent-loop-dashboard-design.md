# autodev v0.3 — Agent Loop, Live Dashboard, and Experiment Gallery

**Date:** 2026-03-16
**Status:** Approved

---

## 1. Problem

autodev v0.2 is a config wizard that ends with "go open Claude Code." This is a broken UX:
- The user configures an LLM provider but never uses it from the app
- There's no way to monitor progress from the web UI
- The user must leave the app to actually run experiments

## 2. Solution

Transform autodev from a config wizard into a fully autonomous app development platform. The user configures, clicks Launch, and watches experiments happen live — never leaving the browser.

Three new subsystems:
1. **Agent Loop** — autonomous experiment cycle (autoresearch-style)
2. **Live Dashboard** — real-time monitoring via SSE
3. **Experiment Gallery** — visual capture of kept experiments with Docker containers

---

## 3. Wizard Redesign — "How do you want to run autodev?"

The current LLM step is replaced with a unified provider chooser:

### 3.1 Provider Options

| Option | Description | User Provides |
|--------|-------------|---------------|
| **API Key** | autodev calls the API directly (Anthropic, OpenAI) | API key + model selection |
| **OAuth** | Authenticate via OAuth to a cloud agent API (Claude, Codex, Z.AI) | OAuth login (browser redirect) |
| **Local CLI** | Spawn an installed CLI tool as a subprocess | Which CLI tool (auto-detected) |
| **Local Inference** | Call a local model server via HTTP | Endpoint URL + model name |

### 3.2 Local CLI Detection

For the Local CLI option, autodev scans the system PATH for known tools:

```
Detected tools:
  claude   v1.2.3  ✓
  codex    —       not found
  gemini   v0.5.1  ✓
  opencode —       not found

  Custom path: [________________]
```

Detection checks: `which claude`, `claude --version`, etc.
If a tool is not in the default location, the user can provide a custom path.

### 3.3 Provider Interface

All providers implement the same interface:

```javascript
interface AgentProvider {
  propose(prompt, context) → Promise<Change[]>
  test() → Promise<{ ok, message }>
}
```

Provider implementations:
- `api-key.js` — `fetch()` to Anthropic/OpenAI API
- `oauth.js` — `fetch()` with OAuth bearer token
- `local-cli.js` — `spawn('claude', ['-p', prompt])` capture stdout
- `local-llm.js` — `fetch()` to `http://localhost:11434/api/generate`

---

## 4. Agent Loop Architecture

### 4.1 Core Loop (autoresearch-style)

```
SETUP:
  1. Create git worktree: git worktree add .autodev-work autodev/<tag>
  2. Run baseline: autodev-score in worktree
  3. Record baseline in results.tsv

LOOP FOREVER:
  1. Build prompt (project context + scoring history + "improve this")
  2. Send to provider → get back file changes
  3. Apply changes to worktree files
  4. git commit in worktree
  5. Run autodev-score → parse composite_score + verdict
  6. If CRASH → log, git reset --hard, continue
  7. If KEEP → advance branch, trigger container + capture
     If DISCARD → git reset --hard HEAD~1, log, continue
  8. Append to results.tsv
  9. Emit SSE events at each step
  10. Check limits (max experiments, time limit)
  11. NEVER STOP unless limits hit or user clicks Stop
```

### 4.2 Git Worktree Isolation

Experiments run in an isolated git worktree, not the user's working tree:

```
~/dev/myproject/                    (user's working tree — untouched)
~/dev/myproject/.autodev-work/      (autodev's isolated copy)
Branch: autodev/<tag>               (experiments committed here)
```

Benefits:
- User can keep coding in their editor
- Crashed experiments can't dirty the user's tree
- `git reset --hard` only affects the worktree
- Improvements land on a branch ready to merge

### 4.3 What the Agent Can/Cannot Touch

| Resource | Agent Access |
|----------|-------------|
| Target project source files (in worktree) | READ + WRITE |
| `autodev-score` pipeline | READ ONLY (runs it, can't modify) |
| `autodev.yaml` | READ ONLY |
| `program.md` | READ ONLY |
| `results.tsv` | APPEND ONLY |
| User's working tree | NO ACCESS |

### 4.4 Crash Handling

- Build fails → status "crash", git reset, move on
- Agent produces unparseable output → retry once, then crash
- Experiment exceeds time budget → kill process, crash
- Agent never asks "should I continue?" — it keeps going

### 4.5 Simplicity Criterion (from autoresearch)

The prompt instructs the agent:
> "All else being equal, simpler is better. A small improvement that adds ugly complexity is not worth it. A 0.001 improvement from deleting code? Definitely keep."

---

## 5. Live Dashboard

### 5.1 Communication: Server-Sent Events (SSE)

One-directional stream from server to browser. No WebSocket needed.

**Endpoint:** `GET /api/sse`

**Event types:**

```
event: status
data: {"phase":"scoring","experiment":7,"step":"judge"}

event: score
data: {"experiment":7,"composite":84.1,"previous":82.3,"verdict":"KEEP","summary":"Extract shared fetch hook"}

event: metrics
data: {"coverage":78.4,"typeErrors":0,"bundleKb":284,"judgeScore":7.5}

event: log
data: {"line":"Analyzing codebase structure...","timestamp":"2026-03-16T22:05:00Z"}

event: experiment_complete
data: {"id":"exp-007","status":"keep","composite":84.1,"containerId":"abc123","port":3407}

event: stats
data: {"total":7,"kept":5,"discarded":1,"crashed":1,"elapsed":"42m","remaining":"~2h 18m"}
```

### 5.2 Dashboard Layout

Six panels, all updating in real-time:

| Panel | Content | SSE Events |
|-------|---------|------------|
| **Status Bar (B)** | Current phase: Analyze → Change → Build → Test → Lint → Score → Judge | `status` |
| **Score Trend (A)** | Line chart of composite score over experiments | `score` |
| **Metrics (F)** | Coverage, type errors, bundle size, judge score with deltas | `metrics` |
| **Stats (G)** | Experiment count, kept/discarded/crashed, elapsed, ETA | `stats` |
| **Experiment Log (D)** | Scrollable table: #, score, verdict, summary, timestamp | `experiment_complete` |
| **Agent Output (E)** | Terminal-style scrolling log of agent activity | `log` |

### 5.3 Dashboard Page

New route: `/dashboard`

After clicking Launch in the wizard, the UI transitions to `/dashboard`. The dashboard is also accessible directly (shows last/current run state).

---

## 6. Container & Process Manager

### 6.1 Strategy

For each KEPT experiment:
1. If Docker is available → run in a container on a unique port
2. If no Docker → spawn the app as a direct process on a unique port

Detection: check `docker --version` at startup.

### 6.2 Port Allocation

Base port: 3401. Each kept experiment gets the next available port.

```
exp-001 → port 3401
exp-003 → port 3402  (exp-002 was discarded, no container)
exp-005 → port 3403
```

### 6.3 Container Lifecycle

```
KEPT experiment detected
  ↓
Copy worktree state to build context
  ↓
Docker: docker build + docker run -d -p {port}:{app_port}
  OR
Process: cd {worktree} && npm start (on assigned port)
  ↓
Wait for health check (HTTP 200 on /)
  ↓
Trigger visual capture (screenshot + GIF)
  ↓
Container stays running until:
  - User stops it from the gallery
  - autodev run ends (cleanup all)
  - Max containers reached (evict oldest)
```

### 6.4 Cleanup

When the autodev run stops:
- Docker: `docker rm -f` all autodev containers
- Process: kill all spawned child processes
- Ports freed

### 6.5 Artifacts Storage

```
.autodev-artifacts/
├── exp-001/
│   ├── screenshot.png    # Static thumbnail (homepage)
│   ├── recording.gif     # 5-10s smart interaction
│   ├── build.log         # Full build output
│   └── meta.json         # Port, container ID, status, timestamp
├── exp-003/
│   └── ...
```

`.autodev-artifacts/` is gitignored.

---

## 7. Visual Capture

### 7.1 Capture Pipeline

After each kept experiment's app is running:

```
1. Launch headless Puppeteer
2. Navigate to http://localhost:{port}
3. Wait for page load (networkidle)
4. Screenshot → screenshot.png

5. Ask LLM: "Given this app at these routes,
   what 2-3 interactions best showcase it?"
6. LLM returns interaction plan:
   [
     { action: "scroll", page: "/" },
     { action: "click", selector: "nav a[href='/dashboard']" },
     { action: "fill", selector: "input[name=search]", value: "test" }
   ]
7. Puppeteer executes each action, captures frames
8. Fallback: if LLM interaction fails, just scroll top-to-bottom
9. Encode frames → recording.gif
```

### 7.2 Smart Interaction

The LLM is asked to produce a simple interaction script based on:
- The app's visible navigation/links
- The page structure (headings, forms, buttons)
- The experiment's description (what changed)

This is a best-effort feature — if the interaction plan fails (element not found, timeout), fall back to simple page scroll.

### 7.3 Experiment Gallery (in Dashboard)

Clicking any experiment in the log opens a detail panel:

```
┌─ Experiment #7 ─────────────────────────────────────────┐
│                                                         │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │  [screenshot]    │  │  Score: 82.3 → 84.1 (+1.8)  │  │
│  │                  │  │  Verdict: KEEP ✓             │  │
│  │                  │  │  Coverage: 78.4% (▲2.1)      │  │
│  └─────────────────┘  │  Type Errors: 0               │  │
│                        │  Bundle: 284kb (▼3.2)         │  │
│  ┌─────────────────┐  │  Judge: 7.5/10                │  │
│  │  [recording.gif] │  │                              │  │
│  │  (auto-playing)  │  │  Summary:                    │  │
│  │                  │  │  "Extract shared fetch hook"  │  │
│  └─────────────────┘  └──────────────────────────────┘  │
│                                                         │
│  [View Live App]  [View Build Log]  [View Diff]         │
│                                                         │
│  ┌─ Live App (iframe) ─────────────────────────────────┐│
│  │                                                     ││
│  │  http://localhost:3407                               ││
│  │                                                     ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## 8. New API Endpoints

```
GET  /api/sse                    # SSE stream for live dashboard updates
POST /api/agent/start            # Start experiment loop
POST /api/agent/stop             # Stop after current experiment
GET  /api/agent/status           # Current state (idle/running/stopping)
GET  /api/detect-tools           # Detect installed CLI tools + versions
GET  /api/experiments            # List all experiments with metadata
GET  /api/experiments/:id        # Single experiment details
GET  /api/experiments/:id/log    # Build log for an experiment
GET  /api/experiments/:id/diff   # Git diff for an experiment
GET  /api/artifacts/:id/:file   # Serve screenshot.png, recording.gif
POST /api/containers/:id/stop   # Stop a specific experiment's container
```

---

## 9. New File Structure

```
server/
├── agent/
│   ├── loop.js               # Main experiment loop controller
│   ├── prompt.js             # Build prompts from project context
│   ├── apply.js              # Apply file changes + git commit/reset
│   ├── events.js             # SSE event emitter (EventEmitter subclass)
│   ├── detector.js           # Detect installed CLI tools in PATH
│   └── providers/
│       ├── base.js           # Provider interface definition
│       ├── api-key.js        # Anthropic/OpenAI direct API
│       ├── oauth.js          # OAuth cloud providers
│       ├── local-cli.js      # Spawn CLI tools as subprocess
│       └── local-llm.js      # Ollama/LM Studio HTTP calls
├── containers/
│   ├── manager.js            # Start/stop/list containers or processes
│   ├── docker.js             # Docker-specific commands
│   ├── process.js            # Direct process fallback
│   └── ports.js              # Port allocation (3401+)
├── capture/
│   ├── screenshot.js         # Puppeteer screenshot capture
│   ├── recorder.js           # GIF recording (frames → GIF)
│   └── interaction.js        # LLM-guided smart interaction planner

web/src/
├── app/
│   └── dashboard/
│       └── page.tsx          # Dashboard page (client component)
├── components/
│   ├── Dashboard.tsx         # Main dashboard container
│   ├── StatusBar.tsx         # Current experiment phase indicator
│   ├── ScoreChart.tsx        # Score trend line chart
│   ├── MetricsPanel.tsx      # Live metric cards with deltas
│   ├── StatsPanel.tsx        # Counts, elapsed time, ETA
│   ├── ExperimentLog.tsx     # Scrollable experiment table
│   ├── AgentOutput.tsx       # Terminal-style log viewer
│   ├── ExperimentDetail.tsx  # Expanded view with screenshots/GIF/iframe
│   └── ExperimentGallery.tsx # Grid of kept experiment thumbnails
├── lib/
│   └── sse.ts               # SSE client hook (useEventSource)
```

---

## 10. Dependencies

New runtime dependencies:
- `puppeteer` — headless browser for screenshots + GIF capture
- `gif-encoder-2` (or similar) — encode frames to GIF

No new framework dependencies. Server remains zero-framework Node.js HTTP.

---

## 11. What Stays Unchanged

- `lib/` scoring engine (hard-gate, metrics, judge, composite)
- `bin/score.js` (autodev-score CLI)
- `bin/report.js` (autodev-report CLI)
- `templates/` (language templates)
- `results.tsv` format and semantics
- `program.md` (agent instructions)
- Landing page and wizard flow (steps 1-2 unchanged, step 3 redesigned, steps 4-6 unchanged)

---

## 12. Data Flow: Prompts, Responses, and File Application

### 12.1 The `Change` Type

Every provider must produce an array of `Change` objects:

```javascript
interface Change {
  path: string;            // Relative to project root, e.g. "src/utils/fetch.ts"
  action: 'create' | 'modify' | 'delete';
  content: string | null;  // Full file content for create/modify, null for delete
}
```

Full file content (not diffs) is used because:
- LLMs produce cleaner output with full files than unified diffs
- Avoids patch application failures
- Simpler to implement and debug

### 12.2 Prompt Template

`prompt.js` builds a structured prompt for the LLM. The prompt has four sections:

```
SYSTEM:
  You are an autonomous app development agent. Your job is to improve
  a codebase one experiment at a time. Each experiment should be a
  focused, small change.

  Respond with ONLY a JSON object:
  {
    "description": "one-line summary of what you changed",
    "category": "quality|feature|refactor|test|performance",
    "changes": [
      { "path": "src/foo.ts", "action": "modify", "content": "full file..." },
      { "path": "src/bar.ts", "action": "create", "content": "full file..." }
    ]
  }

CONTEXT:
  Project: {name} ({language}/{framework})
  Structure: {tree output of key directories}
  Key files: {content of 3-5 most relevant source files}

SCORING HISTORY:
  Last 10 experiments from results.tsv:
  #3 82.3 KEEP   "Add input validation"
  #4 82.3 DISCARD "Switch to axios (no gain)"
  #5 81.0 CRASH   "Tried async refactor (OOM)"

  Current metrics:
  - Coverage: 78.4%
  - Type errors: 0
  - Bundle: 284kb

INSTRUCTION:
  Analyze the codebase and propose ONE focused improvement.
  Prefer: test coverage gaps, dead code removal, small refactors.
  Avoid: large rewrites, new dependencies, config changes.
  All else being equal, simpler is better.
```

### 12.3 Per-Provider Parsing

| Provider | Raw Output | Parsing Strategy |
|----------|-----------|-----------------|
| **API Key** | LLM returns JSON in message content | `JSON.parse()` the response text, extract `changes[]` |
| **OAuth** | Same as API Key (different auth mechanism) | Same parsing |
| **Local CLI** | CLI stdout contains mixed text + code | Parse JSON block from stdout (look for `{` ... `}` containing `"changes"`) |
| **Local Inference** | Ollama returns JSON in `response` field | `JSON.parse(response)`, extract `changes[]` |

All providers attempt JSON extraction with a fallback regex: `/\{[\s\S]*"changes"[\s\S]*\}/`.
If parsing fails after 1 retry, the experiment is recorded as CRASH.

### 12.4 How `apply.js` Writes Changes

```javascript
function applyChanges(worktreePath, changes) {
  for (const change of changes) {
    const fullPath = path.join(worktreePath, change.path);
    switch (change.action) {
      case 'create':
      case 'modify':
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, change.content, 'utf-8');
        break;
      case 'delete':
        unlinkSync(fullPath);
        break;
    }
  }
  // Stage and commit
  execSync('git add -A', { cwd: worktreePath });
  execSync('git commit -m "experiment: {description}"', { cwd: worktreePath });
}
```

Revert on DISCARD:
```javascript
execSync('git reset --hard HEAD~1', { cwd: worktreePath });
```

### 12.5 Relationship Between `program.md` and Automated Prompts

`program.md` is the human-readable playbook for when a user runs autodev manually with Claude Code. The automated loop does NOT use `program.md` — it uses `prompt.js` to build structured prompts. Both encode the same methodology (experiment → score → keep/discard) but in different formats:

| | `program.md` | `prompt.js` |
|---|---|---|
| **Audience** | Human-operated AI agent (Claude Code) | API/CLI call |
| **Format** | Natural language markdown | Structured prompt template |
| **Output** | Agent uses tools to edit files | JSON with `changes[]` array |
| **Used by** | Manual mode | Automated loop |

---

## 13. Configuration Schema

### 13.1 Updated `autodev.yaml`

The agent provider and judge provider are configured independently:

```yaml
target: ~/dev/myproject
template: nextjs

# Agent provider — the LLM that proposes code changes
agent:
  type: api-key          # api-key | oauth | local-cli | local-inference
  # For api-key:
  provider: anthropic    # anthropic | openai
  model: claude-sonnet-4-6
  api_key: "${ANTHROPIC_API_KEY}"
  # For local-cli:
  # tool: claude         # claude | codex | gemini | opencode | pi
  # path: /usr/local/bin/claude   # optional custom path
  # For local-inference:
  # endpoint: http://localhost:11434
  # model: qwen3:4b

# Scoring configuration (unchanged from v0.2)
scoring:
  hard_gate:
    - npm run build
    - npm run test
    - npm run lint
  weights:
    test_coverage: 0.25
    type_errors: 0.10
    judge_score: 0.65
  judge:
    default:
      small: cloud
      medium: cloud
      large: cloud
    local:
      endpoint: http://192.168.50.4:11434
      model: qwen3:4b
    cloud:
      provider: anthropic
      model: claude-sonnet-4-6

# Run configuration
run:
  max_experiments: 50
  time_limit: 8h
  aggressiveness: balanced
  creativity: moderate

# Container/process configuration
containers:
  max_running: 5          # Max simultaneous containers
  start_port: 3401        # Port range base
  app_command: npm start   # Command to start the app (auto-detected from template)
  docker: auto             # auto | always | never

notifications:
  browser: true
```

### 13.2 Agent vs. Judge

| | Agent Provider | Judge Provider |
|---|---|---|
| **Purpose** | Proposes code changes | Scores code changes |
| **Config key** | `agent:` | `scoring.judge:` |
| **Called when** | Step 2 of loop (propose) | Step 5 of loop (score, inside autodev-score) |
| **Can be same LLM** | Yes, but independent config | Yes |

---

## 14. API Request/Response Schemas

### 14.1 `POST /api/agent/start`

```json
// Request
{
  "configPath": "autodev.yaml",   // path to config (optional, uses default)
  "tag": "mar16"                  // run tag for branch name (optional, auto-generated)
}

// Response
{
  "runId": "mar16",
  "branch": "autodev/mar16",
  "worktree": "/path/to/.autodev-work",
  "status": "starting"
}
```

### 14.2 `POST /api/agent/stop`

```json
// Request (no body needed)

// Response
{
  "status": "stopping",
  "message": "Will stop after current experiment completes"
}
```

Stop semantics: sets a `stopping` flag. The loop checks this flag between experiments (after the verdict is recorded). The current experiment always finishes completely — no mid-experiment kills.

### 14.3 `GET /api/agent/status`

```json
// Response
{
  "status": "running",           // idle | running | stopping | stopped
  "runId": "mar16",
  "currentExperiment": 7,
  "phase": "scoring",            // analyzing | proposing | applying | scoring | judging | deciding
  "stats": {
    "total": 7,
    "kept": 5,
    "discarded": 1,
    "crashed": 1,
    "elapsed": "42m",
    "remaining": "~2h 18m"
  },
  "latestScore": 84.1,
  "baselineScore": 78.0
}
```

This endpoint provides the full dashboard snapshot for SSE reconnection.
On page load or reconnect, the client fetches this + `GET /api/experiments` to hydrate state, then subscribes to SSE for live updates.

### 14.4 `GET /api/detect-tools`

```json
// Response
{
  "docker": { "available": true, "version": "24.0.7" },
  "tools": [
    { "name": "claude", "available": true, "version": "1.2.3", "path": "/usr/local/bin/claude" },
    { "name": "codex", "available": false },
    { "name": "gemini", "available": true, "version": "0.5.1", "path": "/usr/local/bin/gemini" },
    { "name": "opencode", "available": false },
    { "name": "pi", "available": false }
  ]
}
```

---

## 15. SSE Reconnection Strategy

When the browser disconnects and reconnects (tab refresh, network blip):

1. Client calls `GET /api/agent/status` to get current snapshot
2. Client calls `GET /api/experiments` to get experiment history
3. Client subscribes to `GET /api/sse` for live updates going forward

No `Last-Event-ID` replay needed — the REST endpoints provide the full current state. SSE is only for incremental updates after connection.

The client uses `EventSource` with automatic reconnection (built-in browser behavior). On reconnect, it re-fetches the snapshot endpoints before re-subscribing.

---

## 16. Container Isolation

### 16.1 Dockerfile Strategy

1. If the target project has a `Dockerfile` → use it
2. If not → auto-generate one based on the template:

```dockerfile
# Auto-generated for Next.js
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci --production
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

Each template (`templates/nextjs.md`, etc.) can define a `dockerfile` section in its scoring overrides. If absent, a generic Dockerfile is generated from the language.

### 16.2 Build Context Per Experiment

Each kept experiment gets its own build context:
```
.autodev-artifacts/exp-007/build/    # Copy of worktree at time of KEEP
```

The worktree itself is shared and advances to the next experiment. The build context copy is what Docker builds from (or what the direct process runs from).

### 16.3 Port Allocation

Monotonically increasing from `containers.start_port` (default 3401). Ports are NOT recycled during a run — simpler, avoids race conditions. The autodev server port (configurable via `AUTODEV_PORT`, default 3333) is always below the container range.

Max simultaneous containers: `containers.max_running` (default 5). When the limit is hit, the oldest container is stopped and removed before starting a new one. Artifacts (screenshots, GIFs) are preserved.

---

## 17. Visual Capture LLM Provider

The interaction planner (Section 7.1 step 5) uses the **agent provider** — it's already configured and available. The interaction planning prompt is lightweight (~200 tokens) so it adds negligible cost.

If the agent provider is a Local CLI (which doesn't support quick one-shot calls easily), fall back to simple page scroll only (no smart interaction).

---

## 18. Out of Scope for MVP

- OAuth provider implementation (API Key + Local CLI + Local Inference first)
- Multi-repo support
- Cloud deployment of autodev itself
- User-defined interaction scripts for GIF capture
