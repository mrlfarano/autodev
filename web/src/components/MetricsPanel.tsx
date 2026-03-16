'use client';

import Card from '@/components/ui/Card';

interface Metric {
  name: string;
  value: number | string | null;
  delta: number | null;
  unit?: string;
}

interface MetricsPanelProps {
  metrics: {
    coverage: number | null;
    typeErrors: number | null;
    bundleKb: number | null;
    judgeScore: number | null;
  };
  deltas: {
    coverage: number | null;
    typeErrors: number | null;
    bundleKb: number | null;
    judgeScore: number | null;
  };
}

function DeltaIndicator({ delta, inverse }: { delta: number | null; inverse?: boolean }) {
  if (delta === null || delta === 0) {
    return <span className="text-xs text-zinc-600">--</span>;
  }

  // For some metrics like typeErrors, lower is better (inverse)
  const isPositive = inverse ? delta < 0 : delta > 0;
  const absVal = Math.abs(delta);

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? 'text-emerald-400' : 'text-red-400'
      }`}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isPositive ? '' : 'rotate-180'}
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      {absVal.toFixed(1)}
    </span>
  );
}

function MetricCard({ name, value, delta, unit, inverse }: Metric & { inverse?: boolean }) {
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {name}
      </span>
      <div className="flex items-end justify-between">
        <span className="text-xl font-bold text-zinc-100">
          {value !== null && value !== undefined ? value : '--'}
          {unit && value !== null && (
            <span className="text-sm font-normal text-zinc-500 ml-0.5">{unit}</span>
          )}
        </span>
        <DeltaIndicator delta={delta} inverse={inverse} />
      </div>
    </Card>
  );
}

export default function MetricsPanel({ metrics, deltas }: MetricsPanelProps) {
  const cards: (Metric & { inverse?: boolean })[] = [
    {
      name: 'Coverage',
      value: metrics.coverage !== null ? metrics.coverage.toFixed(1) : null,
      delta: deltas.coverage,
      unit: '%',
    },
    {
      name: 'Type Errors',
      value: metrics.typeErrors,
      delta: deltas.typeErrors,
      inverse: true,
    },
    {
      name: 'Bundle',
      value: metrics.bundleKb !== null ? metrics.bundleKb.toFixed(1) : null,
      delta: deltas.bundleKb,
      unit: 'KB',
      inverse: true,
    },
    {
      name: 'Judge Score',
      value: metrics.judgeScore !== null ? metrics.judgeScore.toFixed(1) : null,
      delta: deltas.judgeScore,
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-sm font-medium text-zinc-400 mb-3">Metrics</h3>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <MetricCard key={card.name} {...card} />
        ))}
      </div>
    </div>
  );
}
