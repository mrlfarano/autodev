'use client';

interface StatusBarProps {
  phase: string;
  experimentNumber: number;
  running: boolean;
}

const PHASES = ['Analyze', 'Propose', 'Apply', 'Score', 'Judge', 'Decide'];

export default function StatusBar({ phase, experimentNumber, running }: StatusBarProps) {
  const activeIndex = PHASES.findIndex(
    (p) => p.toLowerCase() === (phase || '').toLowerCase()
  );

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              running ? 'bg-emerald-400 animate-pulse-glow' : 'bg-zinc-600'
            }`}
          />
          <span className="text-sm font-medium text-zinc-300">
            {running ? `Experiment #${experimentNumber}` : 'Idle'}
          </span>
        </div>
        {running && phase && (
          <span className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
            {phase}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {PHASES.map((p, i) => {
          const isCompleted = running && i < activeIndex;
          const isActive = running && i === activeIndex;
          const isPending = !running || i > activeIndex;

          return (
            <div key={p} className="flex items-center flex-1">
              <div
                className={`
                  flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium w-full transition-all duration-300
                  ${isActive ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40' : ''}
                  ${isCompleted ? 'bg-emerald-900/20 text-emerald-500/80' : ''}
                  ${isPending ? 'bg-zinc-800/50 text-zinc-600' : ''}
                `}
              >
                {isCompleted && (
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
                )}
                {p}
              </div>
              {i < PHASES.length - 1 && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isCompleted ? '#34d399' : '#3f3f46'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 mx-0.5"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
