import fs from "node:fs";

export const HEADER = "commit\tcomposite\tgate\tjudge\tcategory\tsize\tstatus\ttimestamp\tdescription";

const COLUMNS = HEADER.split("\t");

export function readResults(tsvPath) {
  if (!fs.existsSync(tsvPath)) return [];
  const lines = fs.readFileSync(tsvPath, "utf-8").trim().split("\n");
  if (lines.length <= 1) return [];
  return lines.slice(1).filter(Boolean).map((line) => {
    const parts = line.split("\t");
    const row = {};
    for (let i = 0; i < COLUMNS.length; i++) {
      row[COLUMNS[i]] = parts[i] ?? "";
    }
    row.composite = parseFloat(row.composite) || 0;
    row.judge = parseFloat(row.judge) || 0;
    return row;
  });
}

export function getPreviousScore(tsvPath) {
  const rows = readResults(tsvPath);
  const kept = rows.filter((r) => r.status === "keep");
  if (kept.length === 0) return null;
  return kept[kept.length - 1].composite;
}

export function getBaseline(tsvPath) {
  const rows = readResults(tsvPath);
  return rows.find((r) => r.status === "keep") ?? null;
}
