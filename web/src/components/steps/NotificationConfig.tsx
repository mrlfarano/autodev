'use client';

import { useState } from 'react';
import Toggle from '@/components/ui/Toggle';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { NotificationConfig as NotifConfigType } from '@/lib/types';
import { testNotification } from '@/lib/api';

interface NotificationConfigProps {
  config: NotifConfigType;
  onChange: (config: NotifConfigType) => void;
}

export default function NotificationConfig({
  config,
  onChange,
}: NotificationConfigProps) {
  const [emailEnabled, setEmailEnabled] = useState(!!config.email);
  const [pushoverEnabled, setPushoverEnabled] = useState(!!config.pushover);
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});
  const [testingType, setTestingType] = useState<string | null>(null);

  async function handleTest(type: string) {
    setTestingType(type);
    try {
      const result = await testNotification(type, config);
      setTestResults((prev) => ({
        ...prev,
        [type]: { ok: result.ok, message: result.message || 'Sent!' },
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [type]: {
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to send test',
        },
      }));
    } finally {
      setTestingType(null);
    }
  }

  function handleBrowserEnable() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then((perm) => {
        onChange({ ...config, browser: perm === 'granted' });
      });
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold mb-2">Notifications</h2>
        <p className="text-zinc-500 text-sm">
          Get notified when autodev finishes or finds something interesting.
        </p>
      </div>

      {/* Browser notifications */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-400"
            >
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <div>
              <p className="text-sm font-medium text-zinc-200">
                Browser Notifications
              </p>
              <p className="text-xs text-zinc-500">Desktop push alerts</p>
            </div>
          </div>
          <Toggle
            checked={config.browser}
            onChange={(checked) => onChange({ ...config, browser: checked })}
          />
        </div>
        {!config.browser && (
          <Button size="sm" variant="secondary" onClick={handleBrowserEnable}>
            Enable Permissions
          </Button>
        )}
        {config.browser && (
          <span className="text-xs text-emerald-400">Permissions granted</span>
        )}
      </Card>

      {/* Email */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-400"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <div>
              <p className="text-sm font-medium text-zinc-200">Email</p>
              <p className="text-xs text-zinc-500">
                Get results delivered to your inbox
              </p>
            </div>
          </div>
          <Toggle
            checked={emailEnabled}
            onChange={(checked) => {
              setEmailEnabled(checked);
              if (!checked) onChange({ ...config, email: undefined });
            }}
          />
        </div>
        {emailEnabled && (
          <div className="flex gap-3 mt-3">
            <div className="flex-1">
              <Input
                placeholder="you@example.com"
                type="email"
                value={config.email || ''}
                onChange={(e) =>
                  onChange({ ...config, email: e.target.value })
                }
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleTest('email')}
              loading={testingType === 'email'}
              disabled={!config.email}
            >
              Send Test
            </Button>
          </div>
        )}
        {testResults.email && (
          <p
            className={`text-xs mt-2 ${
              testResults.email.ok ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {testResults.email.message}
          </p>
        )}
      </Card>

      {/* Pushover */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-400"
            >
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            <div>
              <p className="text-sm font-medium text-zinc-200">Pushover</p>
              <p className="text-xs text-zinc-500">
                Mobile push notifications via Pushover
              </p>
            </div>
          </div>
          <Toggle
            checked={pushoverEnabled}
            onChange={(checked) => {
              setPushoverEnabled(checked);
              if (!checked)
                onChange({ ...config, pushover: undefined });
            }}
          />
        </div>
        {pushoverEnabled && (
          <div className="space-y-3 mt-3">
            <Input
              label="App Token"
              type="password"
              placeholder="Pushover app token"
              value={config.pushover?.token || ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  pushover: {
                    token: e.target.value,
                    user: config.pushover?.user || '',
                  },
                })
              }
            />
            <Input
              label="User Key"
              type="password"
              placeholder="Pushover user key"
              value={config.pushover?.user || ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  pushover: {
                    token: config.pushover?.token || '',
                    user: e.target.value,
                  },
                })
              }
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleTest('pushover')}
              loading={testingType === 'pushover'}
              disabled={
                !config.pushover?.token || !config.pushover?.user
              }
            >
              Send Test
            </Button>
            {testResults.pushover && (
              <p
                className={`text-xs ${
                  testResults.pushover.ok
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}
              >
                {testResults.pushover.message}
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
