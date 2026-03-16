## Framework: Python

### Agent Context
- Project uses Python with standard tooling
- Testing: pytest (tests/ directory), coverage via coverage.py or pytest-cov
- Linting: ruff (fast Python linter) or flake8
- Type checking: mypy or pyright
- Package management: pip/poetry/uv
- Virtual environment expected in .venv/ or venv/

### Scoring Overrides

hard_gate:
  - python -m pytest
  - ruff check .

metrics:
  test_coverage:
    command: "python -m pytest --cov --cov-report=term 2>&1"
    parse: "TOTAL.*?(\\d+)%"
    direction: higher_is_better
  type_errors:
    command: "python -m mypy . --ignore-missing-imports 2>&1 | grep -c 'error:' || echo 0"
    parse: stdout_as_number
    direction: lower_is_better
  code_quality:
    command: "ruff check . --statistics 2>&1 | tail -1"
    parse: "Found (\\d+) error"
    parse_default: "0"
    direction: lower_is_better
