## Framework: TypeScript / Node.js

### Agent Context
- Project uses TypeScript with Node.js
- Testing: vitest, jest, or mocha
- Linting: eslint
- Type checking: tsc --noEmit
- Package manager: npm, yarn, or pnpm

### Scoring Overrides

hard_gate:
  - npm run build
  - npm test
  - npm run lint

metrics:
  test_coverage:
    command: "npx vitest run --coverage --reporter=json 2>&1"
    parse: "\"pct\"\\s*:\\s*(\\d+\\.?\\d*)"
    direction: higher_is_better
  type_errors:
    command: "npx tsc --noEmit 2>&1 | grep -c 'error TS' || echo 0"
    parse: stdout_as_number
    direction: lower_is_better
