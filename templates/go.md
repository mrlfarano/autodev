## Framework: Go

### Agent Context
- Project uses Go with Go modules
- Testing: go test ./...
- Linting: golangci-lint run (if available) or go vet ./...
- Formatting: gofmt (Go enforces formatting)
- Coverage: go test -coverprofile
- Build: go build ./...

### Scoring Overrides

hard_gate:
  - go build ./...
  - go test ./...
  - go vet ./...

metrics:
  test_coverage:
    command: "go test -coverprofile=/tmp/autodev-cover.out ./... 2>&1 && go tool cover -func=/tmp/autodev-cover.out | grep total | awk '{print $3}' | tr -d '%'"
    parse: stdout_as_number
    direction: higher_is_better
  vet_issues:
    command: "go vet ./... 2>&1 | grep -c ':' || echo 0"
    parse: stdout_as_number
    direction: lower_is_better
