// Legacy map kept for backward compatibility with old configs
// that use weight keys like "bundle_size" → "bundle_score"
const LEGACY_METRIC_SCORE_KEYS = {
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
      // First try the generic pattern: {key}_score
      const genericScoreKey = `${weightKey}_score`;
      // Then try the legacy mapping
      const legacyScoreKey = LEGACY_METRIC_SCORE_KEYS[weightKey];

      const value = metrics[genericScoreKey] ?? metrics[legacyScoreKey] ?? 0;
      composite += weight * value;
    }
  }
  return Math.round(composite * 10) / 10;
}

export function decideVerdict(compositeScore, previousScore) {
  if (previousScore === null || previousScore === undefined) return "KEEP";
  return compositeScore >= previousScore ? "KEEP" : "DISCARD";
}
