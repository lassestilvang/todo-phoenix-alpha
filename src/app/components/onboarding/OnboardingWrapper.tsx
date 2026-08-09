'use client';

import { useOnboarding } from '@/lib/onboarding/useOnboarding';
import { WelcomeStep } from './WelcomeStep';
import { CreateFirstTaskStep } from './CreateFirstTaskStep';
import { VoiceDemoStep } from './VoiceDemoStep';
import { ViewsTourStep } from './ViewsTourStep';
import { ShortcutsStep } from './ShortcutsStep';
import { PreferencesStep } from './PreferencesStep';
import { CompletionStep } from './CompletionStep';

export function OnboardingWrapper() {
  const {
    state,
    currentStep,
    nextStep,
    prevStep,
    completeOnboarding,
    skipOnboarding,
    updatePreferences,
    isValid,
  } = useOnboarding();

  // Check if onboarding should be shown
  if (!state || (!state.showOnboarding && !state.completedAt && !state.skipped)) {
    return null;
  }

  // Don't show if completed or skipped
  if (state.completedAt || state.skipped) {
    return null;
  }

  const renderStepComponent = () => {
    switch (currentStep.component) {
      case 'WelcomeStep':
        return <WelcomeStep />;
      case 'CreateFirstTaskStep':
        return <CreateFirstTaskStep />;
      case 'VoiceDemoStep':
        return <VoiceDemoStep />;
      case 'ViewsTourStep':
        return <ViewsTourStep />;
      case 'ShortcutsStep':
        return <ShortcutsStep />;
      case 'PreferencesStep':
        return <PreferencesStep />;
      case 'CompletionStep':
        return <CompletionStep />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="relative w-full max-w-5xl h-full max-h-[90vh] overflow-hidden rounded-2xl bg-background shadow-3xl">
        {/* Close Button */}
        <button
          onClick={() => skipOnboarding()}
          className="absolute top-4 right-4 z-20 rounded-full p-2 hover:bg-muted transition-colors"
          aria-label="Skip onboarding"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="absolute inset-0 p-6">
          <div className="flex h-full w-full overflow-hidden">
            {/* Progress Bar Container */}
            <div className="hidden md:flex flex-col items-center justify-center w-20">
              <div className="h-12 w-0.5 bg-primary/30">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div
                    key={index}
                    className={`h-4 bg-${
                      index < state.completedSteps.length
                        ? 'primary'
                        : 'primary/20'
                    } w-full`}
                  />
                ))}
              </div>
            </div>

            {/* Step Content */}
            <div className="flex-1 p-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">
                    Step {state.currentStep + 1}: {currentStep.title}
                  </h2>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-muted-foreground">
                      {Math.round(
                        (state.completedSteps.length / 7) * 100
                      )}% Complete
                    </span>
                    <div className="h-2 w-full bg-primary/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            (state.completedSteps.length / 7) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {renderStepComponent()}

                <div className="border-t border-border pt-6">
                  <div className="flex justify-between">
                    <button
                      onClick={prevStep}
                      disabled={state.currentStep === 0}
                      className="px-4 py-2 border border-input rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                    >
                      Previous
                    </button>
                    <div className="flex space-x-2">
                      {currentStep.skipable && (
                        <button
                          onClick={skipOnboarding}
                          className="px-4 py-2 text-muted-foreground hover:text-foreground"
                        >
                          Skip Tour
                        </button>
                      )}
                      <button
                        onClick={nextStep}
                        disabled={!isValid && currentStep.validation}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
                      >
                        {currentStep.id === 'complete' ? 'Finish' : 'Next'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}