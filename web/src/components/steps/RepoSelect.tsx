'use client';

import { useState } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Repo } from '@/lib/types';
import { scanRepos, browseFolder } from '@/lib/api';

interface RepoSelectProps {
  repoPath: string;
  onSelect: (repo: Repo) => void;
  onPathChange: (path: string) => void;
}

interface BrowseState {
  current: string;
  parent: string | null;
  dirs: string[];
  isGitRepo: boolean;
}

export default function RepoSelect({
  repoPath,
  onSelect,
  onPathChange,
}: RepoSelectProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [browsing, setBrowsing] = useState(false);
  const [browseData, setBrowseData] = useState<BrowseState | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);

  async function handleScan() {
    setScanning(true);
    setError('');
    try {
      const data = await scanRepos();
      setRepos(data.repos || []);
      if (!data.repos?.length) {
        setError('No repositories found. Try entering a path manually.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to scan. Is the autodev server running?',
      );
    } finally {
      setScanning(false);
    }
  }

  async function openBrowser(dir?: string) {
    setBrowseLoading(true);
    try {
      const data = await browseFolder(dir);
      setBrowseData(data);
      setBrowsing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Browse failed');
    } finally {
      setBrowseLoading(false);
    }
  }

  function selectBrowsedFolder() {
    if (browseData) {
      onPathChange(browseData.current);
      setBrowsing(false);
      setBrowseData(null);
    }
  }

  const languageIcon: Record<string, string> = {
    python: '\uD83D\uDC0D',
    rust: '\uD83E\uDD80',
    go: '\uD83D\uDC39',
    java: '\u2615',
    typescript: '\uD83D\uDC8E',
    javascript: '\uD83D\uDC8E',
    csharp: '\uD83C\uDFAF',
    ruby: '\uD83D\uDC8E',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold mb-2">Select Your Repository</h2>
        <p className="text-zinc-500 text-sm">
          Choose the project you want autodev to improve.
        </p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            label="Repository Path"
            placeholder="/path/to/your/project"
            value={repoPath}
            onChange={(e) => onPathChange(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button
            variant="secondary"
            onClick={() => openBrowser()}
            loading={browseLoading}
          >
            <span className="flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              Browse
            </span>
          </Button>
          <Button variant="secondary" onClick={handleScan} loading={scanning}>
            Scan for repos
          </Button>
        </div>
      </div>

      {/* Inline folder browser */}
      {browsing && browseData && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-2 min-w-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 shrink-0">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <span className="text-xs font-mono text-zinc-400 truncate">
                {browseData.current}
              </span>
              {browseData.isGitRepo && (
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded shrink-0">
                  git
                </span>
              )}
            </div>
            <button
              onClick={() => { setBrowsing(false); setBrowseData(null); }}
              className="text-zinc-500 hover:text-zinc-300 ml-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Directory list */}
          <div className="max-h-64 overflow-y-auto">
            {browseData.parent && (
              <button
                onClick={() => openBrowser(browseData.parent!)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                ..
              </button>
            )}
            {browseData.dirs.length === 0 && (
              <p className="px-4 py-3 text-sm text-zinc-600">No subdirectories</p>
            )}
            {browseData.dirs.map((dir) => (
              <button
                key={dir}
                onClick={() => openBrowser(browseData.current + '/' + dir)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 shrink-0">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
                {dir}
              </button>
            ))}
          </div>

          {/* Select button */}
          <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {browseData.isGitRepo ? 'This is a git repository' : 'Navigate to a git repo'}
            </span>
            <Button size="sm" onClick={selectBrowsedFolder}>
              Select This Folder
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {repos.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-400">
            Found {repos.length} repositories
          </p>
          <div className="grid gap-3">
            {repos.map((repo) => (
              <Card
                key={repo.path}
                hoverable
                selected={repoPath === repo.path}
                onClick={() => {
                  onPathChange(repo.path);
                  onSelect(repo);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {languageIcon[repo.detectedLanguage] || '\uD83D\uDCC1'}
                    </span>
                    <div>
                      <h3 className="font-semibold text-zinc-100">
                        {repo.name}
                      </h3>
                      <p className="text-xs text-zinc-500 font-mono">
                        {repo.path}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {repo.detectedLanguage}
                    </span>
                    <p className="text-xs text-zinc-600 mt-1">
                      {repo.branch} &middot; {repo.lastCommit}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {repoPath && (
        <div className="text-sm text-emerald-400 flex items-center gap-2">
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
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Repository selected: <span className="font-mono">{repoPath}</span>
        </div>
      )}
    </div>
  );
}
