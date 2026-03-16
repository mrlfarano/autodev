import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center text-center pt-24 pb-20 px-6 overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-32 right-1/4 w-[300px] h-[300px] bg-emerald-600/3 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 animate-fade-in">
        {/* Logo mark */}
        <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 text-sm text-zinc-400">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Autonomous App Development
        </div>

        <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight mb-6">
          <span className="text-zinc-100">auto</span>
          <span className="text-emerald-400">dev</span>
        </h1>

        <p className="text-xl sm:text-2xl text-zinc-400 max-w-2xl mx-auto mb-4 font-light">
          Point an AI at your codebase.
          <br />
          Wake up to a better project.
        </p>

        <p className="text-sm text-zinc-500 max-w-lg mx-auto mb-10">
          autodev loops through your code autonomously&mdash;analyzing, refactoring,
          testing, and scoring each change&mdash;keeping only the improvements.
        </p>

        {/* Flow diagram */}
        <div className="mb-10">
          <div className="inline-flex flex-col items-center gap-3">
            {/* Top row: Analyze → Change → Score */}
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900/80 text-sm font-mono text-zinc-300">
                Analyze
              </div>
              <svg width="24" height="12" viewBox="0 0 24 12" className="text-zinc-600">
                <path d="M0 6h18M14 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <div className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900/80 text-sm font-mono text-zinc-300">
                Change
              </div>
              <svg width="24" height="12" viewBox="0 0 24 12" className="text-zinc-600">
                <path d="M0 6h18M14 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <div className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900/80 text-sm font-mono text-zinc-300">
                Score
              </div>
            </div>
            {/* Loop arrows: Score → Keep? → Analyze */}
            <div className="flex items-center gap-6">
              <svg width="20" height="24" viewBox="0 0 20 24" className="text-zinc-600">
                <path d="M10 0v18M5 14l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="px-4 py-2 rounded-lg border border-emerald-700/50 bg-emerald-500/5 text-sm font-mono text-emerald-400">
              Keep?
            </div>
            <svg width="20" height="16" viewBox="0 0 20 16" className="text-zinc-600">
              <path d="M10 16V4M5 8l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-xs text-zinc-600 font-mono -mt-2">loop</span>
          </div>
        </div>

        <div className="flex items-center gap-4 justify-center">
          <Link
            href="/setup"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg
              bg-emerald-600 hover:bg-emerald-500 text-white font-medium
              text-base shadow-lg shadow-emerald-900/30
              transition-all duration-200 hover:shadow-emerald-900/50"
          >
            Get Started
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
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <a
            href="https://github.com/mrlfarano/autodev"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg
              bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-base
              border border-zinc-700 transition-all duration-200"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
