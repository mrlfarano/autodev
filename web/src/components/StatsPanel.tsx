'use client';

interface StatsPanelProps {
  stats: {
    total: number;
    kept: number;
    discarded: number;
    crashed: number;
    elapsedMs: number;
    estimatedRemainingMs: number | null;
  };
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800/60 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className={`text-sm font-medium ${color || 'text-zinc-200'}`}>{value}</span>
    </div>
  );
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-sm font-medium text-zinc-400 mb-3">Statistics</h3>
      <div className="flex flex-col">
        <StatRow label="Total Experiments" value={stats.total} />
        <StatRow label="Kept" value={stats.kept} color="text-emerald-400" />
        <StatRow label="Discarded" value={stats.discarded} color="text-red-400" />
        <StatRow label="Crashed" value={stats.crashed} color="text-orange-400" />
        <StatRow label="Elapsed" value={formatDuration(stats.elapsedMs)} />
        <StatRow
          label="Est. Remaining"
          value={
            stats.estimatedRemainingMs !== null
              ? formatDuration(stats.estimatedRemainingMs)
              : '--'
          }
        />
      </div>
    </div>
  );
}
