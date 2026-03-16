const BASE =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export async function scanRepos() {
  const res = await fetch(`${BASE}/api/scan-repos`);
  if (!res.ok) throw new Error(`Scan failed: ${res.statusText}`);
  return res.json();
}

export async function detectLanguage(repoPath: string) {
  const res = await fetch(`${BASE}/api/detect-language`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath }),
  });
  if (!res.ok) throw new Error(`Detection failed: ${res.statusText}`);
  return res.json();
}

export async function getLanguages() {
  const res = await fetch(`${BASE}/api/languages`);
  if (!res.ok) throw new Error(`Failed to fetch languages: ${res.statusText}`);
  return res.json();
}

export async function validateLlm(config: Json) {
  const res = await fetch(`${BASE}/api/validate-llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Validation failed: ${res.statusText}`);
  return res.json();
}

export async function saveConfig(config: Json) {
  const res = await fetch(`${BASE}/api/save-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.statusText}`);
  return res.json();
}

export async function startRun(configPath: string) {
  const res = await fetch(`${BASE}/api/start-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configPath }),
  });
  if (!res.ok) throw new Error(`Start failed: ${res.statusText}`);
  return res.json();
}

export async function browseFolder(dir?: string): Promise<{
  current: string;
  parent: string | null;
  dirs: string[];
  isGitRepo: boolean;
}> {
  const params = dir ? `?dir=${encodeURIComponent(dir)}` : '';
  const res = await fetch(`${BASE}/api/browse-folder${params}`);
  if (!res.ok) throw new Error(`Browse failed: ${res.statusText}`);
  return res.json();
}

export async function testNotification(type: string, config: Json) {
  const res = await fetch(`${BASE}/api/test-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, config }),
  });
  if (!res.ok) throw new Error(`Test failed: ${res.statusText}`);
  return res.json();
}

export async function detectTools() {
  const res = await fetch(`${BASE}/api/detect-tools`);
  if (!res.ok) throw new Error('Detection failed');
  return res.json();
}

export async function startAgent(config: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/agent/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Start failed');
  return res.json();
}
