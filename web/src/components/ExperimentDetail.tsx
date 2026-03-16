'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';

interface ExperimentDetailProps {
  experiment: {
    id: string;
    composite: number;
    status: string;
    description: string;
    metrics: Record<string, number>;
    port?: number;
  };
  previousScore?: number;
  onClose: () => void;
}

const BASE =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : '';

function ScoreBadge({ score, previous }: { score: number; previous?: number }) {
  const delta = previous !== undefined ? score - previous : null;
  const color =
    score >= 80
      ? 'text-emerald-400'
      : score >= 50
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-3xl font-bold font-mono ${color}`}>
        {score.toFixed(1)}
      </span>
      {delta !== null && delta !== 0 && (
        <span
          className={`text-sm font-medium ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}
        >
          {delta > 0 ? '+' : ''}
          {delta.toFixed(1)}
        </span>
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: number | undefined }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50 last:border-0">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-mono text-zinc-200">{value.toFixed(1)}</span>
    </div>
  );
}

export default function ExperimentDetail({
  experiment,
  previousScore,
  onClose,
}: ExperimentDetailProps) {
  const [activeView, setActiveView] = useState<'screenshot' | 'gif' | 'live' | null>(null);
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

  const screenshotUrl = `${BASE}/api/artifacts/${experiment.id}/screenshot.png`;
  const gifUrl = `${BASE}/api/artifacts/${experiment.id}/recording.gif`;
  const liveUrl = experiment.port ? `http://localhost:${experiment.port}` : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-zinc-100">
            Experiment{' '}
            <span className="text-emerald-400 font-mono">#{experiment.id}</span>
          </h3>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              experiment.status === 'keep'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : experiment.status === 'discard'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
            }`}
          >
            {experiment.status.toUpperCase()}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
          aria-label="Close detail panel"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Media area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Screenshot */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Screenshot
            </span>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden aspect-video flex items-center justify-center">
              {imgError.screenshot ? (
                <div className="text-zinc-600 text-xs text-center p-4">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="mx-auto mb-2 text-zinc-700"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  No screenshot available
                </div>
              ) : (
                <img
                  src={screenshotUrl}
                  alt={`Screenshot of experiment ${experiment.id}`}
                  className="w-full h-full object-cover"
                  onError={() => setImgError((prev) => ({ ...prev, screenshot: true }))}
                />
              )}
            </div>
          </div>

          {/* GIF */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Recording
            </span>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden aspect-video flex items-center justify-center">
              {imgError.gif ? (
                <div className="text-zinc-600 text-xs text-center p-4">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="mx-auto mb-2 text-zinc-700"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  No recording available
                </div>
              ) : (
                <img
                  src={gifUrl}
                  alt={`Recording of experiment ${experiment.id}`}
                  className="w-full h-full object-cover"
                  onError={() => setImgError((prev) => ({ ...prev, gif: true }))}
                />
              )}
            </div>
          </div>
        </div>

        {/* Score + Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Score */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Composite Score
            </span>
            <div className="mt-2">
              <ScoreBadge score={experiment.composite} previous={previousScore} />
            </div>
          </div>

          {/* Metric breakdown */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Metrics Breakdown
            </span>
            <div className="mt-2">
              <MetricRow label="Coverage" value={experiment.metrics.coverage} />
              <MetricRow label="Type Errors" value={experiment.metrics.typeErrors} />
              <MetricRow label="Bundle KB" value={experiment.metrics.bundleKb} />
              <MetricRow label="Judge Score" value={experiment.metrics.judgeScore} />
            </div>
          </div>
        </div>

        {/* Description */}
        {experiment.description && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Summary
            </span>
            <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
              {experiment.description}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          {liveUrl && (
            <Button
              variant={activeView === 'live' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setActiveView(activeView === 'live' ? null : 'live')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
              {activeView === 'live' ? 'Hide Live App' : 'View Live App'}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              window.open(`${BASE}/api/artifacts/${experiment.id}/`, '_blank');
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Build Log
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              window.open(`${BASE}/api/artifacts/${experiment.id}/diff`, '_blank');
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
            View Diff
          </Button>
        </div>

        {/* Live App iframe */}
        {activeView === 'live' && liveUrl && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              </div>
              <span className="text-xs text-zinc-500 font-mono flex-1 text-center">
                {liveUrl}
              </span>
            </div>
            <iframe
              src={liveUrl}
              title={`Live preview of experiment ${experiment.id}`}
              className="w-full border-0"
              style={{ height: '500px' }}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}
      </div>
    </div>
  );
}
