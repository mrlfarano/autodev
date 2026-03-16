'use client';

import Button from '@/components/ui/Button';

const STEP_LABELS = [
  'Repository',
  'Language',
  'LLM',
  'Run Config',
  'Notifications',
  'Review',
];

interface WizardNavProps {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  canNext?: boolean;
}

export default function WizardNav({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  canNext = true,
}: WizardNavProps) {
  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full
                  text-xs font-medium transition-all duration-300 shrink-0
                  ${
                    i < currentStep
                      ? 'bg-emerald-600 text-white'
                      : i === currentStep
                        ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40'
                        : 'bg-zinc-800 text-zinc-600'
                  }
                `}
              >
                {i < currentStep ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs hidden sm:block truncate transition-colors ${
                  i <= currentStep ? 'text-zinc-300' : 'text-zinc-600'
                }`}
              >
                {STEP_LABELS[i]}
              </span>
            </div>
            {i < totalSteps - 1 && (
              <div
                className={`h-px flex-1 mx-2 transition-colors duration-300 ${
                  i < currentStep ? 'bg-emerald-600' : 'bg-zinc-800'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
        <Button
          variant="secondary"
          onClick={onPrev}
          disabled={currentStep === 0}
        >
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
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </Button>

        {currentStep < totalSteps - 1 ? (
          <Button onClick={onNext} disabled={!canNext}>
            Next
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
          </Button>
        ) : null}
      </div>
    </div>
  );
}
