'use client';

import { useRouter } from 'next/navigation';
import { useOnboarding } from '@/lib/onboarding/useOnboarding';

export function WelcomeStep() {
  const { nextStep, updatePreferences } = useOnboarding();
  const router = useRouter();

  const handleGetStarted = () => {
    updatePreferences({ voiceInputDemo: true });
    nextStep();
  };

  const handleSkip = () => {
    // Skip onboarding entirely
    // This would be handled by the parent onboarding component
  };

  return (
    <div className="onboarding-step welcome-step flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-background to-muted">
      <div className="space-y-8">
        <div className="text-5xl mb-4">🚀</div>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome to Todo Phoenix
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl">
          Your intelligent task management companion with AI assistance,
          voice input, and smart scheduling to boost your productivity.
        </p>

        <div className="flex space-x-4">
          <button
            onClick={handleGetStarted}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Get Started
          </button>
          <button
            onClick={handleSkip}
            className="px-6 py-3 border border-input hover:bg-accent rounded-lg font-medium"
          >
            Skip Tour
          </button>
        </div>

        <div className="text-xs text-muted-foreground">
          Press Escape anytime to skip the tour
        </div>
      </div>
    </div>
  );
}