const METRIC_SCORE_KEYS = {
  bundle_size: "bundle_score",
  test_coverage: "coverage_score",
  type_errors: "type_score",
};

export function computeComposite(weights, metrics, judgeScore) {
  let composite = 0;
  for (const [weightKey, weight] of Object.entries(weights)) {
    if (weightKey === "judge_score") {
      composite += weight * (judgeScore * 10);
    } else {
      const metricKey = METRIC_SCORE_KEYS[weightKey];
      const value = metricKey ? (metrics[metricKey] ?? 0) : 0;
      composite += weight * value;
    }
  }
  return Math.round(composite * 10) / 10;
}

export function decideVerdict(compositeScore, previousScore) {
  if (previousScore === null || previousScore === undefined) return "KEEP";
  return compositeScore >= previousScore ? "KEEP" : "DISCARD";
}
