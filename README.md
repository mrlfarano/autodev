<h1 align="center">autodev</h1>

<p align="center">
  <strong>Autonomous app development experiments</strong>
</p>

<p align="center">
  <a href="https://github.com/mrlfarano/autodev/actions/workflows/ci.yml"><img src="https://github.com/mrlfarano/autodev/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/mrlfarano/autodev/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.17-brightgreen.svg" alt="Node.js"></a>
</p>

<p align="center">
  Give an AI agent your app, a scoring harness, and a loop — wake up to a better codebase.
</p>

---

Inspired by Andrej Karpathy's [autoresearch](https://github.com/karpathy/autoresearch): instead of training a neural net and reading `val_bpb`, you modify application code and read a composite quality score. Same idea, different domain.

**autodev** provides two CLI tools — `autodev-score` (a layered evaluation harness) and `autodev-report` (a self-contained HTML report generator) — that an AI coding agent calls in a continuous improvement loop. Each iteration, the agent makes a change, commits it, scores it, and keeps or reverts it. The agent loops indefinitely — ~12 experiments per hour, ~100 overnight.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  YOU (human)                                                    │
│  ├── Configure autodev.yaml (target project, scoring weights)   │
│  ├── Customize program.md (agent instructions)                  │
│  ├── Launch AI agent (Claude, Codex, etc.) in your project      │
│  └── Sleep                                                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  AI CODING AGENT                                                │
│                                                                 │
│  Reads program.md, then loops forever:                          │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────────────┐  │
│  │ Analyze  │──▶│ Implement│──▶│  Commit  │──▶│autodev-score│  │
│  │ codebase │   │ change   │   │          │   │             │  │
│  └──────────┘   └──────────┘   └──────────┘   └──────┬─────┘  │
│       ▲                                               │        │
│       │         ┌────────────┐   ┌────────────┐       │        │
│       └─────────│  Discard   │◀──│  Verdict?  │◀──────┘        │
│                 │ git reset  │   └─────┬──────┘                │
│                 └────────────┘         │                       │
│                                  ┌─────▼──────┐               │
│                                  │    Keep     │               │
│                                  │   advance   │               │
│                                  └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  AUTODEV-SCORE (the fixed evaluation harness)                   │
│                                                                 │
│  Step 1 ─ Hard Gate         build + test + lint (must pass)     │
│  Step 2 ─ Metrics           bundle size, test coverage, types   │
│  Step 3 ─ LLM Judge         local Ollama or cloud API           │
│  Step 4 ─ Composite Score   weighted average → KEEP / DISCARD   │
└─────────────────────────────────────────────────────────────────┘
```

The agent autonomously picks what to work on across three experiment types:

| Type | Examples |
|------|---------|
| **Quality** | Refactors, dead code removal, type safety, accessibility |
| **Feature** | New pages, API endpoints, components, integrations |
| **UI/UX** | Design polish, animations, responsive layout, dark mode |

## Installation

**Requirements:** Node.js 18.17+

```bash
git clone https://github.com/mrlfarano/autodev.git
cd autodev
npm install
npm link    # makes autodev-score and autodev-report available globally
```

## Usage

### 1. Configure

```bash
cp autodev.yaml.example autodev.yaml
```

Edit `autodev.yaml` — at minimum, set `target` to your project path:

```yaml
target: ~/dev/my-app

scoring:
  hard_gate:
    - npm run build
    - npm run test
    - npm run lint

  weights:
    bundle_size: 0.10
    test_coverage: 0.20
    type_errors: 0.10
    judge_score: 0.60

  judge:
    default:
      small: local
      medium: local
      large: cloud
    local:
      endpoint: http://localhost:11434
      model: qwen3:4b
      timeout: 60
    cloud:
      provider: anthropic
      model: claude-sonnet-4-6
      max_tokens: 1024
```

See [Configuration](#configuration) for all options.

### 2. Set the config path

```bash
export AUTODEV_CONFIG=$(pwd)/autodev.yaml
```

### 3. Launch an agent in your project

```bash
cd ~/dev/my-app
claude    # or codex, cursor, etc.
```

Then prompt:

> Read ~/path/to/autodev/program.md and let's kick off a new experiment!

The agent reads `program.md`, creates a branch, establishes a baseline score, and starts looping through experiments autonomously.

### 4. Review results

After the agent has been running (minutes, hours, overnight):

```bash
autodev-report    # generates autodev-report.html in your project
```

Open the HTML file to see score progression, top improvements, category breakdown, and near-misses.

### Scoring pipeline

Scoring is **layered** — cheap checks first, expensive checks only when the cheap ones pass:

| Step | What | Cost | On failure |
|------|------|------|------------|
| **Hard Gate** | `build && test && lint` | Free | CRASH (skip everything) |
| **Metrics** | Bundle size, coverage, type errors | Free | Score penalty |
| **LLM Judge** | Correctness, quality, impact, risk | Free (local) or ~$0.02 (cloud) | Low score |
| **Composite** | Weighted average | — | KEEP or DISCARD |

### Judge inference

The LLM judge provider is configurable per experiment size:

| Size | Default | Rationale |
|------|---------|-----------|
| `small` | Local (Ollama) | Quick refactors don't need deep review |
| `medium` | Local (Ollama) | Component changes are straightforward |
| `large` | Cloud (Anthropic) | New features warrant thorough assessment |

Override per-run: `autodev-score --judge cloud` or `--judge local`.

### Example output

`autodev-score` produces grep-friendly output:

```
---
gate:             PASS
bundle_kb:        284.7
test_coverage:    78.4
type_errors:      0
judge_score:      7.5/10
judge_summary:    "Clean refactor, good test coverage"
composite_score:  82.3
previous_score:   80.1
verdict:          KEEP
---
```

## Configuration

All configuration lives in a single `autodev.yaml` file.

| Field | Default | Description |
|-------|---------|-------------|
| `target` | *(required)* | Absolute or `~`-expanded path to the target project |
| `template` | auto-detected | `nextjs`, `generic`, or path to a custom `.md` template |
| `budgets.small` | `5` | Time budget (minutes) for small experiments |
| `budgets.medium` | `15` | Time budget for medium experiments |
| `budgets.large` | `30` | Time budget for large experiments |
| `branch_prefix` | `autodev` | Git branch prefix for experiment runs |
| `scoring.hard_gate` | *(required)* | Shell commands that must all exit 0 |
| `scoring.weights` | *(required)* | Metric weights (must sum to 1.0) |
| `scoring.judge.default` | — | Judge provider per size: `local` or `cloud` |
| `scoring.judge.local` | — | Ollama endpoint, model, and timeout |
| `scoring.judge.cloud` | — | Anthropic provider, model, and max_tokens |

### Templates

Templates provide framework-specific scoring defaults and agent context. `autodev.yaml` settings always override template defaults.

| Template | Auto-detected by | Description |
|----------|-----------------|-------------|
| `nextjs` | `next.config.ts` / `.js` | Next.js App Router, shadcn/ui, Tailwind, Vitest + Playwright |
| `generic` | fallback | No defaults — you must configure `scoring.hard_gate` in YAML |

Custom templates: `template: ./path/to/my-template.md`

### CLI reference

**`autodev-score`** — the evaluation harness

```bash
autodev-score                        # full pipeline
autodev-score --gate-only            # quick build/test/lint check
autodev-score --no-judge             # skip LLM judge
autodev-score --size large           # declare experiment size
autodev-score --judge cloud          # force cloud judge
autodev-score --config ./path.yaml   # custom config path
```

**`autodev-report`** — post-run reporting

```bash
autodev-report                       # HTML report (default)
autodev-report --format md           # markdown report
autodev-report --since 2026-03-15    # filter by date
autodev-report --output ./report.html
```

## Support

Open an [issue](https://github.com/mrlfarano/autodev/issues) for bugs or feature requests.

## Roadmap

- [ ] Additional framework templates (Vite, Python, Rust)
- [ ] `autodev-report` interactive HTML charts with Chart.js
- [ ] Parallel experiment support (multiple agents, separate branches)
- [ ] `npx autodev-score` without cloning the repo
- [ ] Screenshot-based UI scoring via vision models

## Contributing

Contributions are welcome.

```bash
# Clone and install
git clone https://github.com/mrlfarano/autodev.git
cd autodev
npm install

# Run tests
npm test

# Run a specific test file
node --test tests/config.test.js
```

The project uses Node.js built-in test runner (`node:test`) with zero dev dependencies. All scoring logic lives in `lib/`, CLI entrypoints in `bin/`, report generation in `reporting/`. Tests mirror `lib/` 1:1 in `tests/`.

## Authors

Built by [@mrlfarano](https://github.com/mrlfarano).

The core idea — autonomous experiments with a fixed evaluation harness — comes from Andrej Karpathy's [autoresearch](https://github.com/karpathy/autoresearch).

## License

[MIT](LICENSE)

## Project status

Active development. This is v0.1 — the scoring pipeline and reporting work end-to-end, but the system has only been tested against Next.js projects so far. Feedback and additional framework templates are welcome.
