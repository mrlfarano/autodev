export function renderMarkdown(reportData) {
  const { summary, topImprovements, categoryBreakdown, nearMisses, crashLog } = reportData;
  let md = "";

  md += `# Autodev Report\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total experiments | ${summary.total} |\n`;
  md += `| Kept | ${summary.kept} |\n`;
  md += `| Discarded | ${summary.discarded} |\n`;
  md += `| Crashed | ${summary.crashed} |\n`;
  md += `| Keep rate | ${summary.keepRate}% |\n`;
  md += `| Baseline score | ${summary.baselineScore} |\n`;
  md += `| Final score | ${summary.finalScore} |\n`;
  md += `| Improvement | +${summary.improvement} |\n\n`;

  if (topImprovements.length > 0) {
    md += `## Top Improvements\n\n`;
    md += `| Rank | Delta | Score | Category | Description |\n|------|-------|-------|----------|-------------|\n`;
    topImprovements.forEach((row, i) => {
      md += `| ${i + 1} | +${row.delta} | ${row.composite} | ${row.category} | ${row.description} |\n`;
    });
    md += "\n";
  }

  if (categoryBreakdown.length > 0) {
    md += `## Category Breakdown\n\n`;
    md += `| Category | Tried | Kept | Rate | Avg Judge |\n|----------|-------|------|------|-----------|\n`;
    categoryBreakdown.forEach((cat) => {
      md += `| ${cat.name} | ${cat.tried} | ${cat.kept} | ${cat.keepRate}% | ${cat.avgJudge} |\n`;
    });
    md += "\n";
  }

  if (nearMisses.length > 0) {
    md += `## Near Misses\n\n`;
    nearMisses.forEach((row) => {
      md += `- **${row.description}** (judge: ${row.judge}, composite: ${row.composite})\n`;
    });
    md += "\n";
  }

  if (crashLog.length > 0) {
    md += `## Crashes\n\n`;
    crashLog.forEach((row) => {
      md += `- ${row.description}\n`;
    });
  }

  return md;
}
