## Framework: C# (.NET)

### Agent Context
- Project uses C# with .NET SDK
- Testing: dotnet test (xUnit, NUnit, or MSTest)
- Build: dotnet build
- Formatting: dotnet format
- Source typically in src/, tests in tests/

### Scoring Overrides

hard_gate:
  - dotnet build --no-restore
  - dotnet test --no-build

metrics:
  test_coverage:
    command: "dotnet test --collect:'XPlat Code Coverage' --results-directory /tmp/autodev-dotnet 2>&1 && cat /tmp/autodev-dotnet/*/coverage.cobertura.xml | grep -o 'line-rate=\"[0-9.]*\"' | head -1"
    parse: "\"(\\d+\\.?\\d*)\""
    parse_default: "0"
    direction: higher_is_better
    optional: true
  build_warnings:
    command: "dotnet build 2>&1 | grep -c 'warning' || echo 0"
    parse: stdout_as_number
    direction: lower_is_better
