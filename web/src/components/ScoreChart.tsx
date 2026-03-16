'use client';

interface ScorePoint {
  experiment: number;
  score: number;
  verdict: string;
}

interface ScoreChartProps {
  scores: ScorePoint[];
  currentScore: number | null;
}

export default function ScoreChart({ scores, currentScore }: ScoreChartProps) {
  if (scores.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-400">Composite Score</h3>
          <span className="text-2xl font-bold text-zinc-600">--</span>
        </div>
        <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
          No experiments yet
        </div>
      </div>
    );
  }

  const allScores = scores.map((s) => s.score);
  const minScore = Math.min(...allScores);
  const maxScore = Math.max(...allScores);
  const range = maxScore - minScore;
  const yMin = range > 0 ? minScore - Math.max(range * 0.15, 3) : minScore - 5;
  const yMax = range > 0 ? maxScore + Math.max(range * 0.15, 3) : maxScore + 5;
  const yRange = yMax - yMin;

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 200;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 30;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  function xPos(i: number) {
    if (scores.length === 1) return padLeft + chartW / 2;
    return padLeft + (i / (scores.length - 1)) * chartW;
  }

  function yPos(score: number) {
    return padTop + chartH - ((score - yMin) / yRange) * chartH;
  }

  // Build polyline points
  const linePoints = scores
    .map((s, i) => `${xPos(i)},${yPos(s.score)}`)
    .join(' ');

  // Y-axis ticks (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = yMin + (yRange * i) / 4;
    return { val, y: yPos(val) };
  });

  // Dot color based on verdict
  function dotColor(verdict: string) {
    const v = verdict.toUpperCase();
    if (v === 'KEEP') return '#22c55e';
    if (v === 'DISCARD') return '#ef4444';
    if (v === 'CRASH') return '#71717a';
    return '#a1a1aa';
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-400">Composite Score</h3>
        <span className="text-2xl font-bold text-emerald-400">
          {currentScore !== null ? currentScore.toFixed(1) : '--'}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              y1={tick.y}
              x2={svgWidth - padRight}
              y2={tick.y}
              stroke="#27272a"
              strokeWidth="1"
            />
            <text
              x={padLeft - 8}
              y={tick.y + 4}
              textAnchor="end"
              fill="#71717a"
              fontSize="10"
              fontFamily="monospace"
            >
              {tick.val.toFixed(0)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {scores.map((s, i) => {
          // Show at most ~10 labels to avoid clutter
          const maxLabels = 10;
          const step = Math.max(1, Math.ceil(scores.length / maxLabels));
          if (i % step !== 0 && i !== scores.length - 1) return null;
          return (
            <text
              key={i}
              x={xPos(i)}
              y={svgHeight - 5}
              textAnchor="middle"
              fill="#71717a"
              fontSize="10"
              fontFamily="monospace"
            >
              #{s.experiment}
            </text>
          );
        })}

        {/* Gradient area under line */}
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        {scores.length > 1 && (
          <polygon
            points={`${xPos(0)},${padTop + chartH} ${linePoints} ${xPos(scores.length - 1)},${padTop + chartH}`}
            fill="url(#scoreGrad)"
          />
        )}

        {/* Score line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="#34d399"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Score dots */}
        {scores.map((s, i) => (
          <circle
            key={i}
            cx={xPos(i)}
            cy={yPos(s.score)}
            r="4"
            fill={dotColor(s.verdict)}
            stroke="#18181b"
            strokeWidth="2"
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          Keep
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          Discard
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
          Crash
        </span>
      </div>
    </div>
  );
}
