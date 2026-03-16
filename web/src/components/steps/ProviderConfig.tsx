'use client';

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { AgentConfig } from '@/lib/types';
import { validateLlm, detectTools } from '@/lib/api';

interface ProviderConfigProps {
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
}

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4 (6)' },
    { value: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
    { value: 'claude-haiku-3-5', label: 'Claude 3.5 Haiku' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o3-mini', label: 'o3-mini' },
  ],
};

interface DetectedTool {
  name: string;
  label: string;
  found: boolean;
  version?: string;
  path?: string;
}

const TYPE_LABELS: { type: AgentConfig['type']; label: string; subtitle: string; disabled?: boolean }[] = [
  { type: 'api-key', label: 'API Key', subtitle: 'Anthropic or OpenAI' },
  { type: 'oauth', label: 'OAuth', subtitle: 'Coming soon', disabled: true },
  { type: 'local-cli', label: 'Local CLI', subtitle: 'Claude, Codex, etc.' },
  { type: 'local-inference', label: 'Local Model', subtitle: 'Ollama / vLLM' },
];

const TYPE_ICONS: Record<AgentConfig['type'], React.ReactNode> = {
  'api-key': (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-zinc-300">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  oauth: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-zinc-500">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  'local-cli': (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-zinc-300">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  'local-inference': (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-zinc-300">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  ),
};

export default function ProviderConfig({ config, onChange }: ProviderConfigProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [tools, setTools] = useState<DetectedTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);

  const loadTools = useCallback(async () => {
    setToolsLoading(true);
    setToolsError(null);
    try {
      const result = await detectTools();
      const detected: DetectedTool[] = result.tools || [];
      setTools(detected);
      // Auto-select first available tool if none selected
      if (!config.tool) {
        const firstAvailable = detected.find((t: DetectedTool) => t.found);
        if (firstAvailable) {
          onChange({ ...config, tool: firstAvailable.name, toolPath: firstAvailable.path });
        }
      }
    } catch (err) {
      setToolsError(err instanceof Error ? err.message : 'Failed to detect tools');
      // Provide fallback data so the UI is still usable
      setTools([
        { name: 'claude', label: 'Claude Code', found: false },
        { name: 'codex', label: 'OpenAI Codex', found: false },
        { name: 'gemini', label: 'Gemini CLI', found: false },
      ]);
    } finally {
      setToolsLoading(false);
    }
  }, [config, onChange]);

  useEffect(() => {
    if (config.type === 'local-cli') {
      loadTools();
    }
    // Only run when type changes to local-cli
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.type]);

  function selectType(type: AgentConfig['type']) {
    setTestResult(null);
    switch (type) {
      case 'api-key':
        onChange({ type: 'api-key', provider: 'anthropic', model: 'claude-sonnet-4-6' });
        break;
      case 'local-cli':
        onChange({ type: 'local-cli', tool: config.tool });
        break;
      case 'local-inference':
        onChange({ type: 'local-inference', endpoint: 'http://localhost:11434', model: 'qwen3:4b' });
        break;
      default:
        break;
    }
  }

  function selectProvider(provider: string) {
    const defaultModel = PROVIDER_MODELS[provider]?.[0]?.value || '';
    onChange({ ...config, provider, model: defaultModel, apiKey: config.apiKey });
    setTestResult(null);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const payload = config.type === 'api-key'
        ? { provider: config.provider, model: config.model, apiKey: config.apiKey }
        : { provider: 'local', model: config.model, endpoint: config.endpoint };
      const result = await validateLlm(payload);
      setTestResult({ ok: result.ok, message: result.message || 'Connected successfully!' });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold mb-2">How do you want to run autodev?</h2>
        <p className="text-zinc-500 text-sm">
          Choose how autodev connects to an AI model.
        </p>
      </div>

      {/* Provider type cards */}
      <div className="grid grid-cols-4 gap-3">
        {TYPE_LABELS.map(({ type, label, subtitle, disabled }) => (
          <Card
            key={type}
            hoverable={!disabled}
            selected={config.type === type}
            onClick={disabled ? undefined : () => selectType(type)}
            className={disabled ? 'opacity-40 cursor-not-allowed' : ''}
          >
            <div className="text-center py-2">
              <div className="mb-3">{TYPE_ICONS[type]}</div>
              <p className="font-semibold text-sm text-zinc-100">{label}</p>
              <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* API Key panel */}
      {config.type === 'api-key' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card
              hoverable
              selected={config.provider === 'anthropic'}
              onClick={() => selectProvider('anthropic')}
            >
              <p className="font-semibold text-sm text-center">Anthropic</p>
            </Card>
            <Card
              hoverable
              selected={config.provider === 'openai'}
              onClick={() => selectProvider('openai')}
            >
              <p className="font-semibold text-sm text-center">OpenAI</p>
            </Card>
          </div>

          <Select
            label="Model"
            value={config.model || ''}
            options={PROVIDER_MODELS[config.provider || 'anthropic'] || []}
            onChange={(e) => onChange({ ...config, model: e.target.value })}
          />

          <Input
            label="API Key"
            type="password"
            placeholder={config.provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
            value={config.apiKey || ''}
            onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
          />

          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={handleTest} loading={testing}>
              Test Connection
            </Button>
            {testResult && (
              <span className={`text-sm ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {testResult.ok ? '\u2713' : '\u2717'} {testResult.message}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Local CLI panel */}
      {config.type === 'local-cli' && (
        <div className="space-y-4">
          {toolsLoading ? (
            <div className="flex items-center gap-3 text-sm text-zinc-400 py-4">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Detecting installed CLI tools...
            </div>
          ) : (
            <>
              {toolsError && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  {toolsError} -- showing defaults
                </p>
              )}
              <div className="space-y-2">
                {tools.map((tool) => (
                  <Card
                    key={tool.name}
                    hoverable={tool.found}
                    selected={config.tool === tool.name}
                    onClick={tool.found ? () => onChange({ ...config, tool: tool.name, toolPath: tool.path }) : undefined}
                    className={!tool.found ? 'opacity-40 cursor-not-allowed' : ''}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {tool.found ? (
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                            {'\u2713'}
                          </span>
                        ) : (
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-zinc-600 text-xs">
                            {'\u2717'}
                          </span>
                        )}
                        <div>
                          <p className="font-medium text-sm text-zinc-100">{tool.label}</p>
                          {tool.version && (
                            <p className="text-xs text-zinc-500">{tool.version}</p>
                          )}
                        </div>
                      </div>
                      {!tool.found && (
                        <span className="text-xs text-zinc-600">Not found</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          <Input
            label="Custom path (optional)"
            placeholder="/usr/local/bin/claude"
            value={config.toolPath || ''}
            onChange={(e) => onChange({ ...config, toolPath: e.target.value })}
          />
        </div>
      )}

      {/* Local Inference panel */}
      {config.type === 'local-inference' && (
        <div className="space-y-4">
          <Input
            label="Endpoint URL"
            placeholder="http://localhost:11434"
            value={config.endpoint || ''}
            onChange={(e) => onChange({ ...config, endpoint: e.target.value })}
          />
          <Input
            label="Model Name"
            placeholder="qwen3:4b"
            value={config.model || ''}
            onChange={(e) => onChange({ ...config, model: e.target.value })}
          />

          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={handleTest} loading={testing}>
              Test Connection
            </Button>
            {testResult && (
              <span className={`text-sm ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {testResult.ok ? '\u2713' : '\u2717'} {testResult.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
