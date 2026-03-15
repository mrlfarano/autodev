# autodev

autodev is an autonomous app development tool that runs an AI coding agent in a continuous improvement loop against your project, scoring each change and keeping only what improves the codebase. It is inspired by [autoresearch](https://github.com/karpathy/autoresearch) — instead of training a neural net and reading `val_bpb`, you modify application code and read a composite quality score.

---

## How it works

```
YOU (human)
 ├── Edit autodev.yaml
 ├── Edit program.md
 ├── Launch AI agent in target repo
 └── Sleep

AI CODING AGENT (Claude/Codex)
 ├── Reads program.md
 ├── LOOP: Analyze → Choose → Implement → Commit → autodev-score → Keep/Discard
 └── Logs to results.tsv

AUTODEV-SCORE
 ├── Hard Gate: build + test + lint
 ├── Metrics: bundle, coverage, types
 ├── Judge: local Ollama or cloud LLM
 └── Composite score → verdict
```

Each experiment is a git commit. If the composite score improves over the baseline, the commit is kept. If not, it is reverted. The agent loops indefinitely until you interrupt it.

---

## Quick start

```bash
git clone https://github.com/mrlfarano/autodev.git
cd autodev
npm install
npm link                          # makes autodev-score available globally
cp autodev.yaml.example autodev.yaml
# Edit autodev.yaml with your target project
export AUTODEV_CONFIG=$(pwd)/autodev.yaml

# Go to your project
cd ~/dev/personal/myollama
claude  # or codex, or any AI agent
# Prompt: "Read ~/dev/personal/autodev/program.md and kick off a new experiment!"
```

The agent reads `program.md` for its full operating instructions and takes it from there.

---

## Configuration reference

`autodev.yaml` controls what project is targeted and how scoring works.

| Field | Description |
|---|---|
| `target` | Absolute or `~`-expanded path to the target project |
| `template` | Framework template: `nextjs`, `generic`, or a path to a custom template file. Auto-detected from the target project if omitted. |
| `budgets.small` | Time budget in minutes for small experiments |
| `budgets.medium` | Time budget in minutes for medium experiments |
| `budgets.large` | Time budget in minutes for large experiments |
| `branch_prefix` | Git branch prefix for experiment runs (default: `autodev`) |
| `scoring.hard_gate` | List of shell commands that must all exit 0. Failure = CRASH verdict. |
| `scoring.weights` | Composite score weights for `bundle_size`, `test_coverage`, `type_errors`, and `judge_score`. Must sum to 1.0. |
| `scoring.judge.default` | Provider per experiment size: `local` or `cloud` |
| `scoring.judge.local` | Ollama endpoint, model, and timeout for local inference |
| `scoring.judge.cloud` | Cloud provider (anthropic) and model for cloud inference |

---

## CLI reference

### `autodev-score`

Runs the full scoring pipeline against the target project.

```
autodev-score [options]
```

| Flag | Description |
|---|---|
| `--gate-only` | Run only the hard gate (build/test/lint). Exit 0 on pass, 1 on fail. Skips metrics and judge. |
| `--no-judge` | Skip the LLM judge. Useful for fast iteration during development. |
| `--size <size>` | Experiment size: `small`, `medium`, or `large`. Determines which judge provider is used. Default: `medium`. |
| `--judge <provider>` | Override judge provider: `local` or `cloud`. Overrides the size-based default. |
| `--config <path>` | Path to autodev.yaml. Falls back to `AUTODEV_CONFIG` env var, then searches upward from cwd. |

Output is line-oriented key-value pairs that can be grepped:

```bash
autodev-score --size small > run.log 2>&1
grep "^composite_score:\|^gate:\|^judge_score:\|^verdict:" run.log
```

### `autodev-report`

Generates a report from `results.tsv`.

```
autodev-report [options]
```

| Flag | Description |
|---|---|
| `--format <fmt>` | Output format: `html` (default) or `md` |
| `--since <date>` | Filter to experiments after this ISO date (e.g., `2026-03-15`) |
| `--output <path>` | Output file path. Defaults to `autodev-report.html` (or `.md`) in the target project. |
| `--config <path>` | Path to autodev.yaml. Falls back to `AUTODEV_CONFIG` env var, then searches upward from cwd. |

---

## Templates

Templates supply framework-specific defaults for hard gate commands and metric collection. The agent also receives framework context that guides its code changes.

| Template | Description |
|---|---|
| `nextjs` | Next.js with App Router, shadcn/ui, Tailwind, Vitest, and Playwright. Parses bundle size from `next build` output. Ships built-in. |
| `generic` | No framework assumptions. You must define `scoring.hard_gate` commands in `autodev.yaml`. Ships built-in. |
| custom | Point `template` at any `.md` file following the same format as the built-in templates. |

Template auto-detection checks the target project's `package.json` for framework dependencies (e.g., presence of `next` → `nextjs` template).

---

## License

MIT
