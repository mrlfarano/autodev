# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in autodev, please report it responsibly.

**Email:** Open a [private security advisory](https://github.com/mrlfarano/autodev/security/advisories/new) on GitHub.

Please do not open public issues for security vulnerabilities.

## Scope

autodev executes shell commands defined in `autodev.yaml` against a target project. The scoring pipeline runs `build`, `test`, and `lint` commands, and optionally sends code diffs to an LLM (local Ollama or cloud Anthropic API).

Users should be aware that:
- `autodev-score` executes arbitrary shell commands from the config file
- The LLM judge sends git diffs to the configured inference endpoint
- Cloud judge calls send diffs to Anthropic's API
