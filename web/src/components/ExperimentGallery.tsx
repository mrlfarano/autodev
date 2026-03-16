'use client';

import { useState } from 'react';

interface GalleryExperiment {
  id: string;
  experiment: number;
  composite: number;
  status: string;
  description: string;
  port?: number;
}

interface ExperimentGalleryProps {
  experiments: GalleryExperiment[];
  onSelect: (id: string) => void;
}

const BASE =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : '';

function GalleryCard({
  experiment,
  onSelect,
}: {
  experiment: GalleryExperiment;
  onSelect: (id: string) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const screenshotUrl = `${BASE}/api/artifacts/${experiment.id}/screenshot.png`;

  const scoreColor =
    experiment.composite >= 80
      ? 'text-emerald-400'
      : experiment.composite >= 50
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <button
      onClick={() => onSelect(experiment.id)}
      className="group rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden text-left
        hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5
        transition-all duration-200 cursor-pointer"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-zinc-900 flex items-center justify-center overflow-hidden">
        {imgError ? (
          <div className="text-zinc-700 flex flex-col items-center gap-1">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="text-[10px]">No preview</span>
          </div>
        ) : (
          <img
            src={screenshotUrl}
            alt={`Experiment ${experiment.experiment}`}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">
            #{experiment.experiment}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            <svg
              width="8"
              height="8"
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
        </div>
        <span className={`text-sm font-bold font-mono ${scoreColor}`}>
          {experiment.composite.toFixed(1)}
        </span>
      </div>
    </button>
  );
}

export default function ExperimentGallery({
  experiments,
  onSelect,
}: ExperimentGalleryProps) {
  // Only show experiments with status === 'keep'
  const kept = experiments.filter((e) => e.status === 'keep');

  if (kept.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-400">Gallery</h3>
        <span className="text-xs text-zinc-600">
          {kept.length} kept experiment{kept.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {kept.map((exp) => (
          <GalleryCard key={exp.id} experiment={exp} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
