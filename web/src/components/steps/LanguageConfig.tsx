'use client';

import { useState, useEffect, useRef } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LanguageGrid from '@/components/LanguageGrid';
import { detectLanguage } from '@/lib/api';

interface LanguageConfigProps {
  repoPath: string;
  detectedLanguage: string;
  selectedLanguage: string;
  onSelect: (lang: string) => void;
}

const TEMPLATES: Record<string, { template: string; gates: string[] }> = {
  python: {
    template: 'templates/python.yaml',
    gates: ['pytest --tb=short', 'mypy . --ignore-missing-imports', 'ruff check .'],
  },
  rust: {
    template: 'templates/rust.yaml',
    gates: ['cargo test', 'cargo clippy -- -D warnings', 'cargo build --release'],
  },
  go: {
    template: 'templates/go.yaml',
    gates: ['go test ./...', 'go vet ./...', 'golangci-lint run'],
  },
  java: {
    template: 'templates/java.yaml',
    gates: ['mvn test', 'mvn compile', 'mvn checkstyle:check'],
  },
  typescript: {
    template: 'templates/typescript.yaml',
    gates: ['npm test', 'npx tsc --noEmit', 'npx eslint .'],
  },
  csharp: {
    template: 'templates/csharp.yaml',
    gates: ['dotnet test', 'dotnet build', 'dotnet format --verify-no-changes'],
  },
  nextjs: {
    template: 'templates/nextjs.yaml',
    gates: ['npm test', 'npx tsc --noEmit', 'npm run build'],
  },
  ruby: {
    template: 'templates/ruby.yaml',
    gates: ['bundle exec rspec', 'bundle exec rubocop', 'bundle exec rake build'],
  },
};

export default function LanguageConfig({
  repoPath,
  detectedLanguage,
  selectedLanguage,
  onSelect,
}: LanguageConfigProps) {
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState<{
    language: string;
    framework: string;
    confidence: number;
    detectedBy: string[];
  } | null>(null);
  const [detectError, setDetectError] = useState('');
  const hasAutoRun = useRef(false);

  const lang = selectedLanguage || detectedLanguage;
  const config = TEMPLATES[lang];

  async function runDetection() {
    if (!repoPath) {
      setDetectError('Select a repository first.');
      return;
    }
    setDetecting(true);
    setDetectError('');
    setDetection(null);
    try {
      const result = await detectLanguage(repoPath);
      setDetection(result);
      if (result.language) {
        onSelect(result.language);
      }
    } catch (err) {
      setDetectError(
        err instanceof Error ? err.message : 'Detection failed',
      );
    } finally {
      setDetecting(false);
    }
  }

  // Auto-detect on mount when a repo is selected
  useEffect(() => {
    if (repoPath && !hasAutoRun.current && !detection) {
      hasAutoRun.current = true;
      runDetection();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold mb-2">Language &amp; Framework</h2>
        <p className="text-zinc-500 text-sm">
          Autodetect your language or select manually.
        </p>
      </div>

      {/* Autodetect section */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400">
              {detecting ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : detection ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              )}
            </div>
            <div>
              {detecting ? (
                <p className="text-sm text-zinc-400">Detecting language...</p>
              ) : detection ? (
                <>
                  <p className="text-sm text-emerald-400">
                    Detected &middot; {Math.round(detection.confidence * 100)}% confidence
                  </p>
                  <p className="text-lg font-semibold text-zinc-100 capitalize">
                    {detection.framework || detection.language}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    via {detection.detectedBy.join(', ')}
                  </p>
                </>
              ) : detectedLanguage ? (
                <>
                  <p className="text-sm text-zinc-400">Auto-detected from scan</p>
                  <p className="text-lg font-semibold text-zinc-100 capitalize">
                    {detectedLanguage}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-zinc-400">Scan your repo to detect language</p>
                  <p className="text-xs text-zinc-500">
                    Checks for package.json, Cargo.toml, go.mod, pyproject.toml, etc.
                  </p>
                </>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => { runDetection(); }}
            loading={detecting}
          >
            Autodetect
          </Button>
        </div>
      </Card>

      {detectError && (
        <div className="text-sm text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded-lg px-4 py-3">
          {detectError}
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-zinc-400 mb-3">
          Or select manually
        </p>
        <LanguageGrid
          selectable
          selected={lang}
          onSelect={onSelect}
        />
      </div>

      {config && (
        <div className="space-y-4">
          <Card>
            <p className="text-sm text-zinc-400 mb-1">Template</p>
            <p className="font-mono text-sm text-emerald-400">
              {config.template}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-zinc-400 mb-3">Hard Gate Commands</p>
            <div className="space-y-2">
              {config.gates.map((gate, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 font-mono text-sm"
                >
                  <span className="text-zinc-600">$</span>
                  <span className="text-zinc-300">{gate}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
