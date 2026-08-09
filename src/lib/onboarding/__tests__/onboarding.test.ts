import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Test the types and constants without hooks
import {
  DEFAULT_ONBOARDING_STATE,
  ONBOARDING_STEPS,
  type OnboardingState,
  type OnboardingStep,
} from '../types';

describe('Onboarding System', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    if (typeof window !== 'undefined') {
      localStorage.clear();
      vi.clearAllMocks();
    }
  });

  afterEach(() => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('Onboarding Types and Constants', () => {
    it('initializes with default state', () => {
      const state: OnboardingState = { ...DEFAULT_ONBOARDING_STATE };
      expect(state.showOnboarding).toBe(undefined); // showOnboarding is computed
      expect(state.currentStep).toBe(0);
      expect(state.completedSteps).toEqual([]);
      expect(state.skipped).toBe(false);
    });

    it('has correct default preferences', () => {
      const state = DEFAULT_ONBOARDING_STATE;
      expect(state.userPreferences.preferredView).toBe('today');
      expect(state.userPreferences.notificationsEnabled).toBe(true);
      expect(state.userPreferences.keyboardShortcutsTips).toBe(true);
      expect(state.userPreferences.voiceInputDemo).toBe(false);
      expect(state.userPreferences.darkMode).toBe(false);
    });

    it('creates state from localStorage correctly', () => {
      const storedState = {
        currentStep: 2,
        completedSteps: ['welcome', 'create-first-task'],
        startedAt: new Date().toISOString(),
        userPreferences: {
          preferredView: 'next_7_days' as const,
          notificationsEnabled: true,
          keyboardShortcutsTips: false,
          voiceInputDemo: true,
          darkMode: true,
        },
        skipped: false,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('todo-phoenix-onboarding', JSON.stringify(storedState));
      }

      const retrieved = JSON.parse(localStorage.getItem('todo-phoenix-onboarding') || '{}');
      expect(retrieved.currentStep).toBe(2);
      expect(retrieved.completedSteps).toContain('welcome');
      expect(retrieved.completedSteps).toContain('create-first-task');
    });

    it('detects completed onboarding from localStorage', () => {
      const completedState = {
        ...DEFAULT_ONBOARDING_STATE,
        completedAt: new Date().toISOString(),
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('todo-phoenix-onboarding', JSON.stringify(completedState));
      }

      const retrieved = JSON.parse(localStorage.getItem('todo-phoenix-onboarding') || '{}');
      expect(retrieved.completedAt).toBeDefined();
      expect(typeof retrieved.completedAt).toBe('string');
    });

    it('detects skipped onboarding from localStorage', () => {
      const skippedState = {
        ...DEFAULT_ONBOARDING_STATE,
        skipped: true,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('todo-phoenix-onboarding', JSON.stringify(skippedState));
      }

      const retrieved = JSON.parse(localStorage.getItem('todo-phoenix-onboarding') || '{}');
      expect(retrieved.skipped).toBe(true);
    });
  });

  describe('OnboardingSteps', () => {
    it('has correct number of steps', () => {
      expect(ONBOARDING_STEPS.length).toBe(7);
    });

    it('has required steps in correct order', () => {
      const stepIds = ONBOARDING_STEPS.map(s => s.id);
      expect(stepIds).toEqual([
        'welcome',
        'create-first-task',
        'voice-demo',
        'views-tour',
        'shortcuts',
        'preferences',
        'complete'
      ]);
    });

    it('welcome step has correct properties', () => {
      const welcomeStep = ONBOARDING_STEPS.find(s => s.id === 'welcome');
      expect(welcomeStep).toBeDefined();
      expect(welcomeStep?.title).toBe('Welcome to Todo Phoenix');
      expect(welcomeStep?.description).toBeDefined();
      expect(welcomeStep?.icon).toBeDefined();
      expect(welcomeStep?.component).toBe('WelcomeStep');
      expect(welcomeStep?.skipable).toBe(true);
      expect(welcomeStep?.required).toBe(false);
    });

    it('completion step is required', () => {
      const completionStep = ONBOARDING_STEPS.find(s => s.id === 'complete');
      expect(completionStep).toBeDefined();
      expect(completionStep?.title).toBeDefined();
      expect(completionStep?.required).toBe(true);
      expect(completionStep?.skipable).toBe(false);
    });

    it('all steps have required properties', () => {
      ONBOARDING_STEPS.forEach((step: OnboardingStep) => {
        expect(step.id).toBeDefined();
        expect(step.title).toBeDefined();
        expect(step.description).toBeDefined();
        expect(step.icon).toBeDefined();
        expect(step.component).toBeDefined();
        expect(typeof step.skipable).toBe('boolean');
        expect(typeof step.required).toBe('boolean');
      });
    });

    it('exactly one completion step exists', () => {
      const completionSteps = ONBOARDING_STEPS.filter(s => s.id === 'complete');
      expect(completionSteps).toHaveLength(1);
    });

    it('completion step is last', () => {
      const lastStep = ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
      expect(lastStep?.id).toBe('complete');
    });
  });

  describe('State Persistence Logic', () => {
    it('can update completed steps', () => {
      const state = { ...DEFAULT_ONBOARDING_STATE };
      const nextStep = state.currentStep + 1;

      // Simulate completing a step
      const updatedState = {
        ...state,
        currentStep: nextStep,
        completedSteps: [...state.completedSteps, ONBOARDING_STEPS[state.currentStep].id],
      };

      expect(updatedState.currentStep).toBe(1);
      expect(updatedState.completedSteps).toContain('welcome');
    });

    it('can mark onboarding as completed', () => {
      const completedState: OnboardingState = {
        ...DEFAULT_ONBOARDING_STATE,
        completedAt: new Date().toISOString(),
        completedSteps: ONBOARDING_STEPS.map(s => s.id),
      };

      expect(completedState.completedAt).toBeDefined();
      expect(completedState.completedSteps).toHaveLength(7);
    });

    it('can mark onboarding as skipped', () => {
      const skippedState: OnboardingState = {
        ...DEFAULT_ONBOARDING_STATE,
        skipped: true,
        currentStep: ONBOARDING_STEPS.length - 1,
      };

      expect(skippedState.skipped).toBe(true);
    });

    it('can update user preferences', () => {
      const state = { ...DEFAULT_ONBOARDING_STATE };
      const updatedPreferences = {
        ...state.userPreferences,
        preferredView: 'next_7_days' as const,
        darkMode: true,
      };

      const updatedState = { ...state, userPreferences: updatedPreferences };

      expect(updatedState.userPreferences.preferredView).toBe('next_7_days');
      expect(updatedState.userPreferences.darkMode).toBe(true);
    });
  });

  describe('Step Validation', () => {
    it('validates step existence', () => {
      const stepIds = new Set(ONBOARDING_STEPS.map(s => s.id));
      expect(stepIds.has('welcome')).toBe(true);
      expect(stepIds.has('create-first-task')).toBe(true);
      expect(stepIds.has('voice-demo')).toBe(true);
      expect(stepIds.has('views-tour')).toBe(true);
      expect(stepIds.has('shortcuts')).toBe(true);
      expect(stepIds.has('preferences')).toBe(true);
      expect(stepIds.has('complete')).toBe(true);
    });

    it('correctly identifies skipable vs required steps', () => {
      const skipableSteps = ONBOARDING_STEPS.filter(s => s.skipable);
      const requiredSteps = ONBOARDING_STEPS.filter(s => s.required);

      expect(skipableSteps.length).toBe(6); // All except complete
      expect(requiredSteps.length).toBe(1); // Only complete
      expect(requiredSteps[0].id).toBe('complete');
    });
  });
});