'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { LlmConfig as LlmConfigType } from '@/lib/types';
import { validateLlm } from '@/lib/api';

interface LlmConfigProps {
  config: LlmConfigType;
  onChange: (config: LlmConfigType) => void;
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

export default function LlmConfig({ config, onChange }: LlmConfigProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const isLocal = config.provider === 'local';
  const isCloud = config.provider === 'anthropic' || config.provider === 'openai';

  function setProvider(provider: LlmConfigType['provider']) {
    if (provider === 'local') {
      onChange({
        provider: 'local',
        model: 'qwen3:4b',
        endpoint: 'http://localhost:11434',
      });
    } else {
      const defaultModel = PROVIDER_MODELS[provider]?.[0]?.value || '';
      onChange({
        provider,
        model: defaultModel,
        apiKey: config.apiKey || '',
      });
    }
    setTestResult(null);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await validateLlm(config);
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
        <h2 className="text-2xl font-bold mb-2">LLM Configuration</h2>
        <p className="text-zinc-500 text-sm">
          Choose which AI model will drive your improvements.
        </p>
      </div>

      {/* Provider toggle */}
      <div className="grid grid-cols-2 gap-4">
        <Card
          hoverable
          selected={isLocal}
          onClick={() => setProvider('local')}
        >
          <div className="text-center py-2">
            <div className="text-3xl mb-3">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto text-zinc-300"
              >
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
            </div>
            <p className="font-semibold text-zinc-100">Local (Ollama)</p>
            <p className="text-xs text-zinc-500 mt-1">Run on your hardware</p>
          </div>
        </Card>

        <Card
          hoverable
          selected={isCloud}
          onClick={() =>
            setProvider(config.provider === 'openai' ? 'openai' : 'anthropic')
          }
        >
          <div className="text-center py-2">
            <div className="text-3xl mb-3">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto text-zinc-300"
              >
                <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
              </svg>
            </div>
            <p className="font-semibold text-zinc-100">Cloud (API)</p>
            <p className="text-xs text-zinc-500 mt-1">Anthropic or OpenAI</p>
          </div>
        </Card>
      </div>

      {/* Local config */}
      {isLocal && (
        <div className="space-y-4">
          <Input
            label="Ollama Endpoint"
            placeholder="http://localhost:11434"
            value={config.endpoint || ''}
            onChange={(e) => onChange({ ...config, endpoint: e.target.value })}
          />
          <Input
            label="Model Name"
            placeholder="qwen3:4b"
            value={config.model}
            onChange={(e) => onChange({ ...config, model: e.target.value })}
          />
        </div>
      )}

      {/* Cloud config */}
      {isCloud && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card
              hoverable
              selected={config.provider === 'anthropic'}
              onClick={() => setProvider('anthropic')}
            >
              <p className="font-semibold text-sm text-center">Anthropic</p>
            </Card>
            <Card
              hoverable
              selected={config.provider === 'openai'}
              onClick={() => setProvider('openai')}
            >
              <p className="font-semibold text-sm text-center">OpenAI</p>
            </Card>
          </div>

          <Select
            label="Model"
            value={config.model}
            options={PROVIDER_MODELS[config.provider] || []}
            onChange={(e) => onChange({ ...config, model: e.target.value })}
          />

          <Input
            label="API Key"
            type="password"
            placeholder={
              config.provider === 'anthropic'
                ? 'sk-ant-...'
                : 'sk-...'
            }
            value={config.apiKey || ''}
            onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
          />
        </div>
      )}

      {/* Test connection */}
      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={handleTest} loading={testing}>
          Test Connection
        </Button>
        {testResult && (
          <span
            className={`text-sm ${
              testResult.ok ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {testResult.ok ? '\u2713' : '\u2717'} {testResult.message}
          </span>
        )}
      </div>
    </div>
  );
}
