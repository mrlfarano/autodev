'use client';

import { useEffect, useRef } from 'react';

export interface LogLine {
  timestamp: number;
  message: string;
}

interface AgentOutputProps {
  lines: LogLine[];
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function AgentOutput({ lines }: AgentOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines.length]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-sm font-medium text-zinc-400 mb-3">Agent Output</h3>
      <div
        ref={scrollRef}
        className="bg-zinc-950 rounded-lg border border-zinc-800 p-4 h-64 overflow-auto font-mono text-xs leading-relaxed"
      >
        {lines.length === 0 ? (
          <div className="text-zinc-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-zinc-700" />
            Waiting for agent output...
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="flex gap-3 hover:bg-zinc-900/50 px-1 -mx-1 rounded">
              <span className="text-zinc-600 shrink-0 select-none">
                {formatTimestamp(line.timestamp)}
              </span>
              <span className="text-zinc-300 break-all">{line.message}</span>
            </div>
          ))
        )}
        {lines.length > 0 && (
          <div className="flex items-center gap-1 mt-1 text-zinc-600">
            <span className="w-1.5 h-3 bg-emerald-500/70 animate-blink" />
          </div>
        )}
      </div>
    </div>
  );
}
