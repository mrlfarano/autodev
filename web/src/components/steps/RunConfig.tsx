'use client';

import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Toggle from '@/components/ui/Toggle';
import { RunConfig as RunConfigType } from '@/lib/types';

interface RunConfigProps {
  config: RunConfigType;
  onChange: (config: RunConfigType) => void;
}

const TIME_OPTIONS = [
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '8h', label: '8 hours (overnight)' },
  { value: 'none', label: 'No limit' },
];

const AGGRESSIVENESS_OPTIONS: {
  value: RunConfigType['aggressiveness'];
  title: string;
  description: string;
}[] = [
  {
    value: 'conservative',
    title: 'Conservative',
    description: 'Small, safe refactors. Low risk.',
  },
  {
    value: 'balanced',
    title: 'Balanced',
    description: 'Mix of refactors and features. Moderate risk.',
  },
  {
    value: 'aggressive',
    title: 'Aggressive',
    description: 'New features, big changes. Higher risk.',
  },
];

const CREATIVITY_OPTIONS: {
  value: RunConfigType['creativity'];
  title: string;
  description: string;
}[] = [
  {
    value: 'safe',
    title: 'Safe',
    description: 'Proven patterns only',
  },
  {
    value: 'moderate',
    title: 'Moderate',
    description: 'Some creative approaches',
  },
  {
    value: 'experimental',
    title: 'Experimental',
    description: 'Try novel solutions',
  },
];

export default function RunConfig({ config, onChange }: RunConfigProps) {
  const unlimited = config.maxExperiments === null;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold mb-2">Run Configuration</h2>
        <p className="text-zinc-500 text-sm">
          How hard should autodev push?
        </p>
      </div>

      {/* Experiment limit */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-400">
            Experiment Limit
          </label>
          <Toggle
            checked={unlimited}
            onChange={(checked) =>
              onChange({
                ...config,
                maxExperiments: checked ? null : 50,
              })
            }
            label="Unlimited"
          />
        </div>
        {!unlimited && (
          <Input
            type="number"
            placeholder="50"
            value={config.maxExperiments ?? ''}
            onChange={(e) =>
              onChange({
                ...config,
                maxExperiments: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        )}
      </div>

      {/* Time limit */}
      <Select
        label="Time Limit"
        value={config.timeLimit}
        options={TIME_OPTIONS}
        onChange={(e) => onChange({ ...config, timeLimit: e.target.value })}
      />

      {/* Aggressiveness */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-zinc-400">Aggressiveness</p>
        <div className="grid grid-cols-3 gap-3">
          {AGGRESSIVENESS_OPTIONS.map((opt) => (
            <Card
              key={opt.value}
              hoverable
              selected={config.aggressiveness === opt.value}
              onClick={() =>
                onChange({ ...config, aggressiveness: opt.value })
              }
            >
              <p className="font-semibold text-sm text-zinc-100 mb-1">
                {opt.title}
              </p>
              <p className="text-xs text-zinc-500">{opt.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Creativity */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-zinc-400">Creativity</p>
        <div className="grid grid-cols-3 gap-3">
          {CREATIVITY_OPTIONS.map((opt) => (
            <Card
              key={opt.value}
              hoverable
              selected={config.creativity === opt.value}
              onClick={() =>
                onChange({ ...config, creativity: opt.value })
              }
            >
              <p className="font-semibold text-sm text-zinc-100 mb-1">
                {opt.title}
              </p>
              <p className="text-xs text-zinc-500">{opt.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
