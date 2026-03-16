## Framework: Ruby

### Agent Context
- Project may use Ruby on Rails or plain Ruby
- Testing: RSpec or Minitest
- Linting: RuboCop
- Bundle management: Bundler (Gemfile)
- Coverage: SimpleCov

### Scoring Overrides

hard_gate:
  - bundle exec rspec
  - bundle exec rubocop

metrics:
  test_coverage:
    command: "COVERAGE=true bundle exec rspec 2>&1 | grep -o 'LOC ([0-9.]*%)' | head -1"
    parse: "\\(([0-9.]+)%\\)"
    parse_default: "0"
    direction: higher_is_better
    optional: true
  rubocop_offenses:
    command: "bundle exec rubocop --format simple 2>&1 | tail -1"
    parse: "(\\d+) offense"
    parse_default: "0"
    direction: lower_is_better
