export interface Repo {
  path: string;
  name: string;
  detectedLanguage: string;
  framework?: string;
  template?: string;
  lastCommit: string;
  branch: string;
}

export interface LanguageInfo {
  id: string;
  name: string;
  icon: string;
  frameworks: string[];
}

export interface LlmConfig {
  provider: 'local' | 'anthropic' | 'openai';
  model: string;
  endpoint?: string;
  apiKey?: string;
}

export interface AgentConfig {
  type: 'api-key' | 'oauth' | 'local-cli' | 'local-inference';
  provider?: string;    // anthropic | openai (for api-key)
  model?: string;
  apiKey?: string;
  tool?: string;        // claude | codex | gemini (for local-cli)
  toolPath?: string;    // custom path override
  endpoint?: string;    // for local-inference
}

export interface RunConfig {
  maxExperiments: number | null;
  timeLimit: string;
  aggressiveness: 'conservative' | 'balanced' | 'aggressive';
  creativity: 'safe' | 'moderate' | 'experimental';
}

export interface NotificationConfig {
  browser: boolean;
  email?: string;
  pushover?: { token: string; user: string };
}

export interface AutodevConfig {
  repoPath: string;
  language: string;
  template: string;
  agent: AgentConfig;
  run: RunConfig;
  notifications: NotificationConfig;
}
