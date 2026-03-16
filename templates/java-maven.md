## Framework: Java (Maven)

### Agent Context
- Project uses Java with Maven build system
- Testing: JUnit via mvn test
- Build: mvn compile / mvn package
- Linting: checkstyle or spotbugs if configured
- Coverage: JaCoCo plugin if configured
- Source in src/main/java/, tests in src/test/java/

### Scoring Overrides

hard_gate:
  - mvn compile -q
  - mvn test -q

metrics:
  test_coverage:
    command: "mvn jacoco:report -q 2>&1 && cat target/site/jacoco/jacoco.csv | tail -n +2 | awk -F',' '{i+=$4+$5; c+=$5} END {printf \"%.1f\", (c/i)*100}'"
    parse: stdout_as_number
    parse_default: "0"
    direction: higher_is_better
    optional: true
  test_count:
    command: "mvn test 2>&1 | grep 'Tests run:' | tail -1"
    parse: "Tests run: (\\d+)"
    direction: higher_is_better
