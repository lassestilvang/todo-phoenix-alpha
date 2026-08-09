export interface OnboardingState {
  currentStep: number;
  completedSteps: string[];
  startedAt: string;
  completedAt?: string;
  userPreferences: {
    preferredView: 'today' | 'next_7_days' | 'all' | 'upcoming';
    notificationsEnabled: boolean;
    keyboardShortcutsTips: boolean;
    voiceInputDemo: boolean;
    darkMode: boolean;
  };
  skipped: boolean;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  component: string;
  validation?: () => boolean;
  skipable: boolean;
  required: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Todo Phoenix',
    description: 'Your intelligent task management companion with AI assistance',
    icon: '🚀',
    component: 'WelcomeStep',
    skipable: true,
    required: false,
  },
  {
    id: 'create-first-task',
    title: 'Create Your First Task',
    description: 'Add a task using natural language or manual entry',
    icon: '✨',
    component: 'CreateFirstTaskStep',
    validation: () => false,
    skipable: true,
    required: false,
  },
  {
    id: 'voice-demo',
    title: 'Voice Input Demo',
    description: 'Try creating tasks with your voice - faster than typing',
    icon: '🎤',
    component: 'VoiceDemoStep',
    skipable: true,
    required: false,
  },
  {
    id: 'views-tour',
    title: 'Explore Views',
    description: 'Today, Next 7 Days, Upcoming, and All tasks views',
    icon: '📋',
    component: 'ViewsTourStep',
    skipable: true,
    required: false,
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Navigate faster with keyboard shortcuts like Ctrl+N',
    icon: '⌨️',
    component: 'ShortcutsStep',
    skipable: true,
    required: false,
  },
  {
    id: 'preferences',
    title: 'Your Preferences',
    description: 'Set up notifications and personalize your experience',
    icon: '⚙️',
    component: 'PreferencesStep',
    skipable: true,
    required: false,
  },
  {
    id: 'complete',
    title: 'You\'ll love using Todo Phoenix!',
    description: 'You\'re all set. Start organizing your tasks and let AI help you stay productive.',
    icon: '🎉',
    component: 'CompletionStep',
    skipable: false,
    required: true,
  },
];

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  currentStep: 0,
  completedSteps: [],
  startedAt: new Date().toISOString(),
  userPreferences: {
    preferredView: 'today',
    notificationsEnabled: true,
    keyboardShortcutsTips: true,
    voiceInputDemo: false,
    darkMode: false,
  },
  skipped: false,
};

export interface OnboardingContextType {
  state: OnboardingState & { showOnboarding: boolean };
  currentStep: OnboardingStep;
  steps: OnboardingStep[];
  nextStep: () => void;
  prevStep: () => void;
  completeOnboarding: () => void;
  skipOnboarding: () => void;
  updatePreferences: (prefs: Partial<OnboardingState['userPreferences']>) => void;
  isValid: boolean;
}