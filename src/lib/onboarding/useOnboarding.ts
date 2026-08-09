'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  OnboardingState,
  OnboardingStep,
  ONBOARDING_STEPS,
  DEFAULT_ONBOARDING_STATE,
  OnboardingContextType,
} from './types';

const STORAGE_KEY = 'todo-phoenix-onboarding';

export function useOnboarding(): OnboardingContextType {
  const [state, setState] = useState<OnboardingState>(() => {
    if (typeof window === 'undefined') return DEFAULT_ONBOARDING_STATE;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as OnboardingState;
        // Check if onboarding was already completed
        if (parsed.completedAt || parsed.skipped) {
          return DEFAULT_ONBOARDING_STATE; // Don't show again
        }
        return { ...DEFAULT_ONBOARDING_STATE, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to parse onboarding state:', e);
    }
    return DEFAULT_ONBOARDING_STATE;
  });

  // Persist state to localStorage
  const persistState = useCallback((newState: OnboardingState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (e) {
      console.warn('Failed to persist onboarding state:', e);
    }
  }, []);

  // Update state with persistence
  const updateState = useCallback((updater: (prev: OnboardingState) => OnboardingState) => {
    setState((prev) => {
      const newState = updater(prev);
      persistState(newState);
      return newState;
    });
  }, [persistState]);

  // Check if onboarding should be shown
  const shouldShowOnboarding = useCallback(() => {
    if (state.completedAt || state.skipped) return false;
    // Don't show if user already has tasks (implied they know the app)
    try {
      const tasks = localStorage.getItem('todo-tasks');
      if (tasks && JSON.parse(tasks).length > 0) return false;
    } catch {
      // Ignore parsing errors
    }
    return true;
  }, [state.completedAt, state.skipped]);

  const currentStep = ONBOARDING_STEPS[state.currentStep];

  const nextStep = useCallback(() => {
    updateState((prev) => {
      const nextIndex = Math.min(prev.currentStep + 1, ONBOARDING_STEPS.length - 1);
      const newCompletedSteps = prev.currentStep < nextIndex
        ? [...prev.completedSteps, ONBOARDING_STEPS[prev.currentStep].id]
        : prev.completedSteps;

      return {
        ...prev,
        currentStep: nextIndex,
        completedSteps: newCompletedSteps,
      };
    });
  }, [updateState]);

  const prevStep = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0),
    }));
  }, [updateState]);

  const completeOnboarding = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      currentStep: ONBOARDING_STEPS.length - 1,
      completedAt: new Date().toISOString(),
      completedSteps: [...prev.completedSteps, ONBOARDING_STEPS[prev.currentStep].id],
    }));
  }, [updateState]);

  const skipOnboarding = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      skipped: true,
      currentStep: ONBOARDING_STEPS.length - 1,
    }));
  }, [updateState]);

  const updatePreferences = useCallback(
    (prefs: Partial<OnboardingState['userPreferences']>) => {
      updateState((prev) => ({
        ...prev,
        userPreferences: { ...prev.userPreferences, ...prefs },
      }));
    },
    [updateState]
  );

  // Reset onboarding (for testing)
  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(DEFAULT_ONBOARDING_STATE);
  }, []);

  // Expose isValid based on current step validation
  const isValid = currentStep?.validation?.() ?? true;

  return {
    state: { ...state, showOnboarding: shouldShowOnboarding() },
    currentStep,
    steps: ONBOARDING_STEPS,
    nextStep,
    prevStep,
    completeOnboarding,
    skipOnboarding,
    updatePreferences,
    isValid,
  };
}

// Hook for components that need to check onboarding status without showing it
export function useOnboardingStatus() {
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as OnboardingState;
        setCompleted(!!parsed.completedAt || !!parsed.skipped);
      } else {
        setCompleted(false);
      }
    } catch {
      setCompleted(false);
    }
  }, []);

  return { completed };
}

// Hook to reset onboarding (for development/testing)
export function useResetOnboarding() {
  return useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }, []);
}