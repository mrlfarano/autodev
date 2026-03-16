'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSSE } from '@/lib/sse';
import Button from '@/components/ui/Button';
import StatusBar from '@/components/StatusBar';
import ScoreChart from '@/components/ScoreChart';
import MetricsPanel from '@/components/MetricsPanel';
import StatsPanel from '@/components/StatsPanel';
import ExperimentLog, { Experiment } from '@/components/ExperimentLog';
import ExperimentDetail from '@/components/ExperimentDetail';
import ExperimentGallery from '@/components/ExperimentGallery';
import AgentOutput, { LogLine } from '@/components/AgentOutput';

const BASE =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : '';

interface ScorePoint {
  experiment: number;
  score: number;
  verdict: string;
}

interface DashboardMetrics {
  coverage: number | null;
  typeErrors: number | null;
  bundleKb: number | null;
  judgeScore: number | null;
}

interface DashboardDeltas {
  coverage: number | null;
  typeErrors: number | null;
  bundleKb: number | null;
  judgeScore: number | null;
}

interface DashboardStats {
  total: number;
  kept: number;
  discarded: number;
  crashed: number;
  elapsedMs: number;
  estimatedRemainingMs: number | null;
}

const emptyMetrics: DashboardMetrics = {
  coverage: null,
  typeErrors: null,
  bundleKb: null,
  judgeScore: null,
};

const emptyDeltas: DashboardDeltas = {
  coverage: null,
  typeErrors: null,
  bundleKb: null,
  judgeScore: null,
};

const emptyStats: DashboardStats = {
  total: 0,
  kept: 0,
  discarded: 0,
  crashed: 0,
  elapsedMs: 0,
  estimatedRemainingMs: null,
};

export default function Dashboard() {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('');
  const [experimentNumber, setExperimentNumber] = useState(0);
  const [scores, setScores] = useState<ScorePoint[]>([]);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [deltas, setDeltas] = useState<DashboardDeltas>(emptyDeltas);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [stopping, setStopping] = useState(false);
  const [selectedExperimentId, setSelectedExperimentId] = useState<number | null>(null);

  const { connected, on } = useSSE(`${BASE}/api/sse`);

  // SSE event handlers
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    cleanups.push(
      on('status', (data: unknown) => {
        const d = data as {
          phase?: string;
          running?: boolean;
          experiment?: number;
        };
        if (d.phase !== undefined) setPhase(d.phase);
        if (d.running !== undefined) setRunning(d.running);
        if (d.experiment !== undefined) setExperimentNumber(d.experiment);
      })
    );

    cleanups.push(
      on('score', (data: unknown) => {
        const d = data as {
          experiment?: number;
          score?: number;
          verdict?: string;
        };
        if (d.score !== undefined) {
          setCurrentScore(d.score);
          if (d.experiment !== undefined && d.verdict !== undefined) {
            setScores((prev) => {
              // Avoid duplicates
              if (prev.some((p) => p.experiment === d.experiment)) return prev;
              return [
                ...prev,
                {
                  experiment: d.experiment!,
                  score: d.score!,
                  verdict: d.verdict!,
                },
              ];
            });
          }
        }
      })
    );

    cleanups.push(
      on('metrics', (data: unknown) => {
        const d = data as {
          coverage?: number;
          typeErrors?: number;
          bundleKb?: number;
          judgeScore?: number;
          deltas?: DashboardDeltas;
        };
        setMetrics({
          coverage: d.coverage ?? null,
          typeErrors: d.typeErrors ?? null,
          bundleKb: d.bundleKb ?? null,
          judgeScore: d.judgeScore ?? null,
        });
        if (d.deltas) {
          setDeltas(d.deltas);
        }
      })
    );

    cleanups.push(
      on('log', (data: unknown) => {
        const d = data as { message?: string };
        if (d.message) {
          setLogLines((prev) => {
            const next = [...prev, { timestamp: Date.now(), message: d.message! }];
            // Keep last 500 lines
            return next.length > 500 ? next.slice(-500) : next;
          });
        }
      })
    );

    const experimentHandler = (data: unknown) => {
      const d = data as Record<string, unknown>;
      const expId = (d.experiment as number) || (d.id as number) || 0;
      if (expId) {
        setExperiments((prev) => {
          if (prev.some((e) => e.id === expId)) return prev;
          return [
            ...prev,
            {
              id: expId,
              score: (d.score as number) ?? 0,
              verdict: (d.status as string) || (d.verdict as string) || 'crashed',
              summary: (d.description as string) || (d.summary as string) || '',
              timestamp: Date.now(),
            },
          ];
        });
      }
    };
    cleanups.push(on('experiment_complete', experimentHandler));
    cleanups.push(on('experiment-complete', experimentHandler));

    cleanups.push(
      on('stats', (data: unknown) => {
        const d = data as Partial<DashboardStats>;
        setStats((prev) => ({
          total: d.total ?? prev.total,
          kept: d.kept ?? prev.kept,
          discarded: d.discarded ?? prev.discarded,
          crashed: d.crashed ?? prev.crashed,
          elapsedMs: d.elapsedMs ?? prev.elapsedMs,
          estimatedRemainingMs:
            d.estimatedRemainingMs !== undefined
              ? d.estimatedRemainingMs
              : prev.estimatedRemainingMs,
        }));
      })
    );

    cleanups.push(
      on('connected', () => {
        // Connection acknowledged
      })
    );

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [on]);

  // Hydration: fetch initial state on mount
  useEffect(() => {
    async function hydrate() {
      try {
        const statusRes = await fetch(`${BASE}/api/agent/status`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.running !== undefined) setRunning(statusData.running);
          if (statusData.phase) setPhase(statusData.phase);
          if (statusData.experiment) setExperimentNumber(statusData.experiment);
          if (statusData.currentScore !== undefined)
            setCurrentScore(statusData.currentScore);
          if (statusData.metrics) {
            setMetrics({
              coverage: statusData.metrics.coverage ?? null,
              typeErrors: statusData.metrics.typeErrors ?? null,
              bundleKb: statusData.metrics.bundleKb ?? null,
              judgeScore: statusData.metrics.judgeScore ?? null,
            });
          }
          if (statusData.stats) {
            setStats((prev) => ({ ...prev, ...statusData.stats }));
          }
        }
      } catch {
        // Server not available — that's fine, we'll wait for SSE
      }

      try {
        const expRes = await fetch(`${BASE}/api/experiments`);
        if (expRes.ok) {
          const expData = await expRes.json();
          if (Array.isArray(expData.experiments)) {
            // Map API shape to frontend Experiment shape
            const mapped: Experiment[] = expData.experiments.map((e: Record<string, unknown>) => ({
              id: (e.experiment as number) || 0,
              score: (e.score as number) || 0,
              verdict: (e.status as string) || 'crashed',
              summary: (e.description as string) || '',
              timestamp: e.durationMs ? Date.now() - (e.durationMs as number) : Date.now(),
            }));
            setExperiments(mapped);
            // Build score points from experiments
            const points: ScorePoint[] = mapped
              .filter((e) => e.score !== undefined)
              .map((e) => ({
                experiment: e.id,
                score: e.score,
                verdict: e.verdict,
              }));
            if (points.length > 0) {
              setScores(points);
              setCurrentScore(points[points.length - 1].score);
            }
          }
        }
      } catch {
        // Server not available
      }
    }

    hydrate();
  }, []);

  const handleStop = useCallback(async () => {
    setStopping(true);
    try {
      await fetch(`${BASE}/api/agent/stop`, { method: 'POST' });
    } catch {
      // Best-effort
    } finally {
      setStopping(false);
    }
  }, []);

  // Not running — idle state
  if (!running && !connected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#71717a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-300 mb-2">Not Running</h2>
          <p className="text-zinc-500 mb-6 max-w-md mx-auto">
            autodev is not currently running. Configure and launch from the setup wizard,
            or start it from the command line.
          </p>
          <Link href="/setup">
            <Button variant="primary" size="lg">
              Go to Setup
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">
            <span className="text-zinc-100">auto</span>
            <span className="text-emerald-400">dev</span>
          </h1>
          <span className="text-sm text-zinc-500">Dashboard</span>
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
              connected
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-emerald-400' : 'bg-zinc-600'
              }`}
            />
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/setup">
            <Button variant="ghost" size="sm">
              Setup
            </Button>
          </Link>
          {running && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleStop}
              loading={stopping}
              className="border-red-900/50 text-red-400 hover:bg-red-950/30 hover:border-red-800"
            >
              Stop
            </Button>
          )}
        </div>
      </div>

      {/* Status Bar — full width */}
      <StatusBar
        phase={phase}
        experimentNumber={experimentNumber}
        running={running}
      />

      {/* Score Chart — full width */}
      <ScoreChart scores={scores} currentScore={currentScore} />

      {/* Metrics + Stats — side by side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricsPanel metrics={metrics} deltas={deltas} />
        <StatsPanel stats={stats} />
      </div>

      {/* Gallery — kept experiments with thumbnails */}
      <ExperimentGallery
        experiments={experiments.map((e) => ({
          id: String(e.id),
          experiment: e.id,
          composite: e.score,
          status: (e.verdict || 'crashed').toLowerCase(),
          description: e.summary || '',
        }))}
        onSelect={(id) => setSelectedExperimentId(Number(id))}
      />

      {/* Experiment Log — full width */}
      <ExperimentLog
        experiments={experiments}
        selectedId={selectedExperimentId}
        onSelect={setSelectedExperimentId}
      />

      {/* Experiment Detail — shown when an experiment is selected */}
      {selectedExperimentId !== null && (() => {
        const exp = experiments.find((e) => e.id === selectedExperimentId);
        if (!exp) return null;
        const sorted = [...experiments].sort((a, b) => a.id - b.id);
        const idx = sorted.findIndex((e) => e.id === selectedExperimentId);
        const prevScore = idx > 0 ? sorted[idx - 1].score : undefined;
        return (
          <ExperimentDetail
            experiment={{
              id: String(exp.id),
              composite: exp.score,
              status: (exp.verdict || 'crashed').toLowerCase(),
              description: exp.summary,
              metrics: {
                coverage: metrics.coverage ?? 0,
                typeErrors: metrics.typeErrors ?? 0,
                bundleKb: metrics.bundleKb ?? 0,
                judgeScore: metrics.judgeScore ?? 0,
              },
            }}
            previousScore={prevScore}
            onClose={() => setSelectedExperimentId(null)}
          />
        );
      })()}

      {/* Agent Output — full width */}
      <AgentOutput lines={logLines} />
    </div>
  );
}
