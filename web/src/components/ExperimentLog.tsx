'use client';

import { useState } from 'react';

export interface Experiment {
  id: number;
  score: number;
  verdict: string;
  summary: string;
  timestamp: number;
}

interface ExperimentLogProps {
  experiments: Experiment[];
  selectedId?: number | null;
  onSelect?: (id: number | null) => void;
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const v = verdict.toUpperCase();
  if (v === 'KEEP') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
        KEEP
      </span>
    );
  }
  if (v === 'DISCARD') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
        DISCARD
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-400">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
      </svg>
      CRASH
    </span>
  );
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ExperimentLog({ experiments, selectedId: controlledSelectedId, onSelect }: ExperimentLogProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<number | null>(null);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;
  const handleSelect = (id: number | null) => {
    if (onSelect) {
      onSelect(id);
    } else {
      setInternalSelectedId(id);
    }
  };
  const sorted = [...experiments].sort((a, b) => b.id - a.id);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-sm font-medium text-zinc-400 mb-3">Experiment Log</h3>
      {sorted.length === 0 ? (
        <div className="text-zinc-600 text-sm text-center py-8">
          No experiments completed yet
        </div>
      ) : (
        <div className="overflow-auto max-h-72">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th className="text-left py-2 px-2 w-12">#</th>
                <th className="text-left py-2 px-2 w-20">Score</th>
                <th className="text-left py-2 px-2 w-24">Verdict</th>
                <th className="text-left py-2 px-2">Summary</th>
                <th className="text-right py-2 px-2 w-24">Time</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((exp) => (
                <tr
                  key={exp.id}
                  onClick={() =>
                    handleSelect(selectedId === exp.id ? null : exp.id)
                  }
                  className={`
                    cursor-pointer border-b border-zinc-800/40 transition-colors
                    ${selectedId === exp.id ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/30'}
                  `}
                >
                  <td className="py-2 px-2 font-mono text-zinc-400">{exp.id}</td>
                  <td className="py-2 px-2 font-mono text-zinc-200">
                    {exp.score.toFixed(1)}
                  </td>
                  <td className="py-2 px-2">
                    <VerdictBadge verdict={exp.verdict} />
                  </td>
                  <td className="py-2 px-2 text-zinc-400 truncate max-w-xs">
                    {exp.summary || '--'}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-zinc-500 text-xs">
                    {formatTime(exp.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
