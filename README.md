<p align="center">
  <h1 align="center">autodev</h1>
  <p align="center">
    Autonomous app development experiments, inspired by <a href="https://github.com/karpathy/autoresearch">autoresearch</a>
  </p>
  <p align="center">
    <a href="#quick-start">Quick Start</a> · <a href="#how-it-works">How It Works</a> · <a href="#configuration">Configuration</a> · <a href="#cli-reference">CLI Reference</a>
  </p>
</p>

---

Give an AI agent your app, a scoring harness, and a loop — wake up to a better codebase.

**autodev** runs an AI coding agent in a continuous improvement loop against your project. Each iteration, the agent makes a change, commits it, and calls `autodev-score` to evaluate it. If the composite score improves, the change is kept. If not, it's reverted. The agent loops indefinitely — 12 experiments per hour, ~100 overnight while you sleep.

Instead of training a neural net and reading `val_bpb`, you modify application code and read a composite quality score. Same idea, different domain.

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

**Three experiment types** — the agent autonomously picks what to work on:

| Type | Examples |
|------|---------|
| **Quality** | Refactors, dead code removal, type safety, accessibility |
| **Feature** | New pages, API endpoints, components, integrations |
| **UI/UX** | Design polish, animations, responsive layout, dark mode |

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/mrlfarano/autodev.git
cd autodev
npm install
npm link

# 2. Configure
cp autodev.yaml.example autodev.yaml
# Edit autodev.yaml — set `target` to your project path

# 3. Set the config path
export AUTODEV_CONFIG=$(pwd)/autodev.yaml

# 4. Launch an agent in your project
cd ~/your-project
claude   # or codex, cursor, etc.
```

Then prompt the agent:

> Read ~/path/to/autodev/program.md and let's kick off a new experiment!

The agent takes it from there — creating a branch, establishing a baseline, and looping through experiments autonomously.

## Scoring Pipeline

The scoring is **layered** — cheap checks first, expensive checks only if the cheap ones pass:

| Step | What | Cost | Failure = |
|------|------|------|-----------|
| **Hard Gate** | `build && test && lint` | Free | CRASH (skip everything else) |
| **Metrics** | Bundle size, test coverage, type errors | Free | Score penalty |
| **LLM Judge** | Correctness, quality, impact, risk (0-10 each) | Free (local) or ~$0.02 (cloud) | Low score |
| **Composite** | Weighted average of above | — | KEEP or DISCARD |

The agent can use `--gate-only` for quick sanity checks during coding, and `--no-judge` to skip the LLM call for faster iterations. The full pipeline only runs at the final evaluation.

### Judge Inference

The judge is configurable per experiment size:

| Size | Default | Rationale |
|------|---------|-----------|
| `small` | Local (Ollama) | Quick refactors don't need deep review |
| `medium` | Local (Ollama) | Component changes are straightforward |
| `large` | Cloud (Anthropic) | New features warrant thorough assessment |

Override per-run with `--judge local` or `--judge cloud`.

## Configuration

All config lives in `autodev.yaml`:

```yaml
# What project to target
target: ~/dev/my-app

# Framework template (auto-detected if omitted)
template: nextjs

# Time budgets per experiment size (minutes)
budgets:
  small: 5
  medium: 15
  large: 30

# Scoring
scoring:
  hard_gate:
    - npm run build
    - npm run test
    - npm run lint

  weights:
    bundle_size: 0.10
    test_coverage: 0.20
    type_errors: 0.10
    judge_score: 0.60       # weights must sum to 1.0

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

## CLI Reference

### `autodev-score`

The evaluation harness. The agent calls this after each experiment.

```bash
autodev-score                        # full pipeline
autodev-score --gate-only            # quick build/test/lint check
autodev-score --no-judge             # skip LLM judge
autodev-score --size large           # use cloud judge (per config)
autodev-score --judge cloud          # force cloud judge
autodev-score --config ./my.yaml     # custom config path
```

Output is grep-friendly:

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

### `autodev-report`

Generates a self-contained HTML report from `results.tsv`. Double-click to open — no server needed.

```bash
autodev-report                       # HTML report (default)
autodev-report --format md           # Markdown report
autodev-report --since 2026-03-15    # Filter by date
autodev-report --output ./report.html
```

The report includes: score progression chart, category breakdown, top improvements, near-misses, and crash log.

## Templates

Templates provide framework-specific scoring defaults and agent context.

| Template | Auto-detected by | Description |
|----------|-----------------|-------------|
| `nextjs` | `next.config.ts` | Next.js App Router, shadcn/ui, Tailwind, Vitest + Playwright |
| `generic` | fallback | No defaults — you must configure `scoring.hard_gate` in YAML |

Custom templates: set `template: ./path/to/my-template.md` in your config.

`autodev.yaml` settings always override template defaults.

## Project Structure

```
autodev/
├── bin/
│   ├── score.js            ← autodev-score CLI
│   └── report.js           ← autodev-report CLI
├── lib/                    ← scoring pipeline modules
│   ├── config.js           ← YAML config loader
│   ├── hard-gate.js        ← build/test/lint runner
│   ├── metrics.js          ← bundle, coverage, type errors
│   ├── judge.js            ← Ollama + Anthropic callers
│   ├── judge-prompt.js     ← rubric + response parsing
│   ├── composite.js        ← weighted score + verdict
│   ├── baseline.js         ← .autodev-baseline.json
│   ├── results.js          ← results.tsv reader
│   └── template.js         ← framework detection
├── reporting/              ← report generation
│   ├── generate.js         ← data from TSV
│   ├── render-html.js      ← HTML output
│   ├── render-md.js        ← Markdown output
│   └── template.html       ← self-contained dark-themed HTML
├── templates/
│   ├── nextjs.md
│   └── generic.md
├── program.md              ← agent instructions
├── autodev.yaml.example    ← example config
└── package.json
```

## Inspiration

This project adapts the core loop from Andrej Karpathy's [autoresearch](https://github.com/karpathy/autoresearch) — autonomous LLM training experiments with a fixed evaluation harness — to general application development. The key insight is the same: give an AI agent a metric to optimize, a codebase to modify, and a keep/discard mechanism, then let it run.

## License

MIT
