## Framework: Rust

### Agent Context
- Project uses Rust with Cargo
- Testing: cargo test (tests in src/ and tests/ directory)
- Linting: cargo clippy
- Formatting: cargo fmt --check
- No separate type checking needed — the compiler handles it
- Coverage via cargo-tarpaulin if available

### Scoring Overrides

hard_gate:
  - cargo build 2>&1
  - cargo test 2>&1
  - cargo clippy -- -D warnings 2>&1

metrics:
  test_coverage:
    command: "cargo tarpaulin --out json 2>&1 | grep -o '\"covered_percent\":[0-9.]*' | head -1"
    parse: ":(\\d+\\.?\\d*)"
    parse_default: "0"
    direction: higher_is_better
    optional: true
  compiler_warnings:
    command: "cargo build 2>&1 | grep -c 'warning\\[' || echo 0"
    parse: stdout_as_number
    direction: lower_is_better
  clippy_warnings:
    command: "cargo clippy 2>&1 | grep -c 'warning:' || echo 0"
    parse: stdout_as_number
    direction: lower_is_better
