## Framework: Java (Gradle)

### Agent Context
- Project uses Java with Gradle build system
- Testing: JUnit via gradle test
- Build: gradle build
- Source in src/main/java/, tests in src/test/java/

### Scoring Overrides

hard_gate:
  - gradle build -q
  - gradle test -q

metrics:
  test_coverage:
    command: "gradle jacocoTestReport -q 2>&1 && cat build/reports/jacoco/test/jacocoTestReport.csv | tail -n +2 | awk -F',' '{i+=$4+$5; c+=$5} END {printf \"%.1f\", (c/i)*100}'"
    parse: stdout_as_number
    parse_default: "0"
    direction: higher_is_better
    optional: true
