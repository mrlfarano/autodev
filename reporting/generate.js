import { readResults } from "../lib/results.js";

export function generateReportData(tsvPath, sinceDate) {
  let rows = readResults(tsvPath);
  if (sinceDate) {
    rows = rows.filter((r) => r.timestamp >= sinceDate);
  }

  const kept = rows.filter((r) => r.status === "keep");
  const discarded = rows.filter((r) => r.status === "discard");
  const crashed = rows.filter((r) => r.status === "crash");

  const baselineScore = kept.length > 0 ? kept[0].composite : 0;
  const finalScore = kept.length > 0 ? kept[kept.length - 1].composite : 0;

  const topImprovements = [];
  for (let i = 1; i < kept.length; i++) {
    topImprovements.push({
      ...kept[i],
      delta: +(kept[i].composite - kept[i - 1].composite).toFixed(1),
    });
  }
  topImprovements.sort((a, b) => b.delta - a.delta);

  const nearMisses = discarded.filter((r) => r.judge >= 7.0);

  const categories = {};
  for (const row of rows) {
    if (row.category === "baseline") continue;
    if (!categories[row.category]) {
      categories[row.category] = { tried: 0, kept: 0, judgeSum: 0 };
    }
    categories[row.category].tried++;
    if (row.status === "keep") categories[row.category].kept++;
    categories[row.category].judgeSum += row.judge;
  }
  const categoryBreakdown = Object.entries(categories).map(([name, data]) => ({
    name,
    tried: data.tried,
    kept: data.kept,
    keepRate: data.tried > 0 ? +(data.kept / data.tried * 100).toFixed(1) : 0,
    avgJudge: data.tried > 0 ? +(data.judgeSum / data.tried).toFixed(1) : 0,
  }));

  return {
    rows,
    summary: {
      total: rows.length,
      kept: kept.length,
      discarded: discarded.length,
      crashed: crashed.length,
      keepRate: rows.length > 0 ? +(kept.length / rows.length * 100).toFixed(1) : 0,
      baselineScore,
      finalScore,
      improvement: +(finalScore - baselineScore).toFixed(1),
    },
    topImprovements,
    nearMisses,
    categoryBreakdown,
    crashLog: crashed,
  };
}
