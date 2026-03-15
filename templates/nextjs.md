## Framework: Next.js

### Agent Context
- App Router in src/app/, API routes in src/app/api/
- Components: React + shadcn/ui in src/components/ui/
- Styling: Tailwind CSS, dark mode via class strategy
- Testing: vitest (unit, tests/unit/), playwright (e2e, tests/e2e/)
- Build: npm run build produces standalone output in .next/

### Scoring Overrides

hard_gate:
  - npm run build
  - npm run test
  - npm run lint

metrics:
  bundle_size:
    command: "npm run build 2>&1"
    parse: "First Load JS shared by all\\s+([\\d.]+)\\s*kB"
    direction: lower_is_better
  test_coverage:
    command: "npx vitest run --coverage --reporter=json"
    parse: "lines.pct"
    direction: higher_is_better
  type_errors:
    command: "npx tsc --noEmit 2>&1 | grep -c 'error TS' || true"
    parse: stdout_as_number
    direction: lower_is_better
