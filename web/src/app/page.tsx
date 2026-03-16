import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import LanguageGrid from '@/components/LanguageGrid';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />

      <HowItWorks />

      {/* Languages section */}
      <section className="py-20 px-6 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Supported Languages
          </h2>
          <p className="text-zinc-500 text-center mb-12 max-w-md mx-auto">
            autodev knows your stack. Templates, gates, and scoring tuned for
            each language.
          </p>
          <LanguageGrid />
        </div>
      </section>

      {/* Example output */}
      <section className="py-20 px-6 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Example Output
          </h2>
          <p className="text-zinc-500 text-center mb-12 max-w-md mx-auto">
            After each iteration, autodev scores the result and decides
            whether to keep it.
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            {/* Terminal chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
              <span className="w-3 h-3 rounded-full bg-zinc-700" />
              <span className="w-3 h-3 rounded-full bg-zinc-700" />
              <span className="w-3 h-3 rounded-full bg-zinc-700" />
              <span className="ml-3 text-xs text-zinc-600 font-mono">
                autodev-score output
              </span>
            </div>

            <div className="p-6 code-block overflow-x-auto">
              <pre className="whitespace-pre"><span className="key">gate</span>:             <span className="pass">PASS</span>{'\n'}<span className="key">bundle_kb</span>:        <span className="number">284.7</span>{'\n'}<span className="key">test_coverage</span>:    <span className="number">78.4</span>{'\n'}<span className="key">type_errors</span>:      <span className="number">0</span>{'\n'}<span className="key">judge_score</span>:      <span className="number">7.5</span>/10{'\n'}<span className="key">judge_summary</span>:    <span className="string">&quot;Clean refactor, good test coverage&quot;</span>{'\n'}<span className="key">composite_score</span>:  <span className="number">82.3</span>{'\n'}<span className="key">previous_score</span>:   <span className="number">80.1</span>{'\n'}<span className="key">verdict</span>:          <span className="pass">KEEP</span></pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-zinc-900">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to ship while you sleep?</h2>
          <p className="text-zinc-500 mb-8">
            Configure autodev in under a minute. Let AI do the rest.
          </p>
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
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <span>
            Built by{' '}
            <a
              href="https://github.com/mrlfarano"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-emerald-400 transition-colors"
            >
              @mrlfarano
            </a>
            {' '}&middot; Inspired by autoresearch
          </span>
          <a
            href="https://github.com/mrlfarano/autodev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}
