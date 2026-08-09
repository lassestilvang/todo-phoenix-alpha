'use client';

import { useOnboarding, useRouter } from '@/lib/onboarding/useOnboarding';
import { useEffect } from 'react';

export function CompletionStep() {
  const { completeOnboarding, updatePreferences, state } = useOnboarding();
  const router = useRouter();

  useEffect(() => {
    // Small delay before completing
    const timer = setTimeout(() => {
      completeOnboarding();
      router.push('/');
    }, 1500);

    return () => clearTimeout(timer);
  }, [completeOnboarding, router]);

  const hasTasksCompleted = state.completedSteps.length >= 6;

  return (
    <div className="onboarding-step completion-step flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl text-center">
        <div className="space-y-8">
          {/* Celebration Icon */}
          <div className="text-6xl mb-4">
            {hasTasksCompleted ? '✅' : '🎉'}
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-foreground">
            All Set!
          </h1>

          {/* Subtitle */}
          <p className="text-muted-foreground text-lg">
            You're ready to start being productive. Todo Phoenix will help you
            stay organized with AI-powered suggestions, smart scheduling, and
            seamless voice input.
          </p>

          {/* Feature Summary */}
          <div className="grid grid-cols-2 gap-4 text-center mb-6">
            <div>
              <div className="text-2xl mb-2">📋</div>
              <div className="text-sm font-medium">Task Management</div>
              <p className="text-xs text-muted-foreground">
                Create, organize, and track tasks
              </p>
            </div>
            <div>
              <div className="text-2xl mb-2">🎤</div>
              <div className="text-sm font-medium">Voice Input</div>
              <p className="text-xs text-muted-foreground">
                Create tasks with your voice
              </p>
            </div>
            <div>
              <div className="text-2xl mb-2">📊</div>
              <div className="text-sm font-medium">Smart Views</div>
              <p className="text-xs text-muted-foreground">
                Multiple task views
              </p>
            </div>
            <div>
              <div className="text-2xl mb-2">📅</div>
              <div className="text-sm font-medium">Reminders</div>
              <p className="text-xs text-muted-foreground">
                Never miss a deadline
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => completeOnboarding()}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Get Started
            </button>
            {hasTasksCompleted && (
              <button
                onClick={() => {
                  // Skip to dashboard
                  completeOnboarding();
                  setTimeout(() => router.push('/'), 100);
                }}
                className="px-6 py-3 border border-input hover:bg-accent rounded-lg font-medium"
              >
                Skip Tour
              </button>
            )}
          </div>

          {/* Footer */}
          <p className="mt-6 text-xs text-muted-foreground">
            Tip: Press Ctrl+N anytime to create tasks quickly
          </p>
        </div>
      </div>
    </div>
  );
}