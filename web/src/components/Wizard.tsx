'use client';

import { useState, useCallback } from 'react';
import WizardNav from '@/components/WizardNav';
import RepoSelect from '@/components/steps/RepoSelect';
import LanguageConfig from '@/components/steps/LanguageConfig';
import ProviderConfig from '@/components/steps/ProviderConfig';
import RunConfig from '@/components/steps/RunConfig';
import NotificationConfig from '@/components/steps/NotificationConfig';
import ReviewLaunch from '@/components/steps/ReviewLaunch';
import {
  AutodevConfig,
  AgentConfig,
  RunConfig as RunConfigType,
  NotificationConfig as NotifConfigType,
  Repo,
} from '@/lib/types';

const TOTAL_STEPS = 6;

const TEMPLATE_MAP: Record<string, string> = {
  python: 'templates/python.yaml',
  rust: 'templates/rust.yaml',
  go: 'templates/go.yaml',
  java: 'templates/java.yaml',
  typescript: 'templates/typescript.yaml',
  csharp: 'templates/csharp.yaml',
  nextjs: 'templates/nextjs.yaml',
  ruby: 'templates/ruby.yaml',
};

export default function Wizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const [config, setConfig] = useState<AutodevConfig>({
    repoPath: '',
    language: '',
    template: '',
    agent: {
      type: 'api-key',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    },
    run: {
      maxExperiments: 50,
      timeLimit: '8h',
      aggressiveness: 'balanced',
      creativity: 'moderate',
    },
    notifications: {
      browser: false,
    },
  });

  const [detectedLanguage, setDetectedLanguage] = useState('');

  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      setDirection('forward');
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setDirection('back');
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  function handleRepoSelect(repo: Repo) {
    setDetectedLanguage(repo.detectedLanguage);
    const lang = repo.detectedLanguage;
    setConfig((c) => ({
      ...c,
      repoPath: repo.path,
      language: lang,
      template: TEMPLATE_MAP[lang] || '',
    }));
    // Auto-advance after selecting repo
    setTimeout(() => {
      setDirection('forward');
      setCurrentStep(1);
    }, 300);
  }

  function handleLanguageSelect(lang: string) {
    setConfig((c) => ({
      ...c,
      language: lang,
      template: TEMPLATE_MAP[lang] || '',
    }));
  }

  function handleAgentChange(agent: AgentConfig) {
    setConfig((c) => ({ ...c, agent }));
  }

  function handleRunChange(run: RunConfigType) {
    setConfig((c) => ({ ...c, run }));
  }

  function handleNotifChange(notifications: NotifConfigType) {
    setConfig((c) => ({ ...c, notifications }));
  }

  // Determine if next button should be enabled
  const canNext = (() => {
    switch (currentStep) {
      case 0:
        return !!config.repoPath;
      case 1:
        return !!config.language;
      case 2:
        return !!config.agent.type;
      default:
        return true;
    }
  })();

  const animationClass =
    direction === 'forward' ? 'animate-slide-left' : 'animate-slide-right';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <WizardNav
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
          onPrev={goPrev}
          onNext={goNext}
          canNext={canNext}
        />
      </div>

      <div key={currentStep} className={animationClass}>
        {currentStep === 0 && (
          <RepoSelect
            repoPath={config.repoPath}
            onSelect={handleRepoSelect}
            onPathChange={(path) =>
              setConfig((c) => ({ ...c, repoPath: path }))
            }
          />
        )}
        {currentStep === 1 && (
          <LanguageConfig
            repoPath={config.repoPath}
            detectedLanguage={detectedLanguage}
            selectedLanguage={config.language}
            onSelect={handleLanguageSelect}
          />
        )}
        {currentStep === 2 && (
          <ProviderConfig config={config.agent} onChange={handleAgentChange} />
        )}
        {currentStep === 3 && (
          <RunConfig config={config.run} onChange={handleRunChange} />
        )}
        {currentStep === 4 && (
          <NotificationConfig
            config={config.notifications}
            onChange={handleNotifChange}
          />
        )}
        {currentStep === 5 && <ReviewLaunch config={config} />}
      </div>
    </div>
  );
}
