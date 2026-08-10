'use client';

import { useState } from 'react';
import { useOnboarding } from '@/lib/onboarding/useOnboarding';

export function PreferencesStep() {
  const { updatePreferences, state, skipOnboarding, nextStep } = useOnboarding();

  const [notificationsEnabled, setNotificationsEnabled] = useState(
    state.userPreferences.notificationsEnabled
  );
  const [darkModeEnabled, setDarkModeEnabled] = useState(
    state.userPreferences.darkMode
  );
  const [voiceInputDemo, setVoiceInputDemo] = useState(
    state.userPreferences.voiceInputDemo
  );
  const [preferredView, setPreferredView] = useState(
    state.userPreferences.preferredView
  );

  const onboardingPrefState = {
    notificationsEnabled,
    darkModeEnabled,
    voiceInputDemo,
    preferredView: preferredView || 'today',
  };

  const handleNotificationsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotificationsEnabled(e.target.checked);
    updatePreferences({ notificationsEnabled: e.target.checked });
  };

  const handleDarkModeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDarkModeEnabled(e.target.checked);
    updatePreferences({ darkMode: e.target.checked });
  };

  const handleVoiceDemoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVoiceInputDemo(e.target.checked);
    updatePreferences({ voiceInputDemo: e.target.checked });
  };

  const handleViewChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPreferredView(e.target.value as any);
    updatePreferences({ preferredView: e.target.value as any });
  };

  const handleComplete = () => {
    // Save final preferences + complete onboarding
    updatePreferences({
      darkMode: darkModeEnabled,
    });
    nextStep();
  };

  return (
    <div className="onboarding-step preferences-step flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center space-y-4">
          <div className="text-5xl">⚙️</div>
          <h1 className="text-3xl font-bold text-foreground">
            Your Preferences
          </h1>
          <p className="text-muted-foreground text-lg">
            Personalize your Todo Phoenix experience to match your workflow.
          </p>
        </div>

        {/* Notifications Setting */}
        <div className="p-4 bg-muted rounded-lg border border-input mb-6">
          <h3 className="font-medium mb-2">Notifications</h3>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={handleNotificationsChange}
              className="w-5 h-5 rounded border-primary cursor-pointer"
            />
            <span className="text-sm text-foreground">Enable task reminders and notifications</span>
          </label>
          <p className="text-xs text-muted-foreground mt-1">
            You'll receive toast notifications for due tasks, reminders, and more
          </p>
        </div>

        {/* Dark Mode Setting */}
        <div className="p-4 bg-muted rounded-lg border border-input mb-6">
          <h3 className="font-medium mb-2">Appearance</h3>
          <div className="flex items-center space-x-3">
            <div className="w-11 h-6 bg-background rounded-full border border-input relative">
              <div
                className="w-5 h-5 bg-primary rounded-full absolute left-3 top-1 transition-all duration-300"
                style={{ transform: darkModeEnabled ? 'translateX(6px)' : 'translateX(0px)' }}
              />
            </div>
            <span className="text-sm text-muted-foreground font-medium">
              {darkModeEnabled ? 'Dark Mode' : 'Light Mode'}
            </span>
            <span
              className="w-11 h-6 bg-background rounded-full border border-input absolute right-3 top-1 transition-all duration-300"
              style={{ transform: darkModeEnabled ? 'translateX(-6px)' : 'translateX(0px)' }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Adapt the app to your preferred color scheme
          </p>
        </div>

        {/* Voice Input Demo Setting */}
        <div className="p-4 bg-muted rounded-lg border border-input mb-6">
          <h3 className="font-medium mb-2">Voice Input</h3>
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={voiceInputDemo}
              onChange={handleVoiceDemoChange}
              className="w-5 h-5 rounded border-primary cursor-pointer"
            />
            <span className="text-sm text-foreground">
              Enable voice input demo during onboarding
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Try voice commands: "Remind me to call tomorrow at 3pm"
          </p>
        </div>

        {/* Default View Setting */}
        <div className="p-4 bg-muted rounded-lg border border-input mb-6">
          <h3 className="font-medium mb-2">Default View</h3>
          <select
            value={preferredView || 'today'}
            onChange={handleViewChange}
            className="w-full p-3 rounded-lg border border-input focus:outline-none focus:border-primary"
          >
            <option value="today">Today</option>
            <option value="next_7_days">Next 7 Days</option>
            <option value="upcoming">Upcoming</option>
            <option value="all">All Tasks</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Sets the default view when you open Todo Phoenix
          </p>
        </div>

        {/* Completed Preview */}
        <div className="p-4 bg-card rounded-lg border border-border mb-6">
          <h3 className="font-medium mb-2">Preview</h3>
          <p className="text-sm text-muted-foreground">
            Your preferences will be saved and can be changed anytime in settings
          </p>
          <ul className="text-xs space-y-1">
            <li>Notifications: {"enabled"}</li>
            <li>Mode: {darkModeEnabled ? 'Dark' : 'Light'}</li>
            <li>Voice: {voiceInputDemo ? 'Demo enabled' : 'Skipped'}</li>
            <li>Default: {preferredView || 'today'}</li>
          </ul>
        </div>

        <div className="flex justify-center space-x-4">
          <button
            onClick={() => updatePreferences({ voiceInputDemo: false })}
            className="px-6 py-3 border border-input hover:bg-accent rounded-lg font-medium text-sm"
            disabled={voiceInputDemo}
          >
            Remove Demo
          </button>
          <button
            onClick={handleComplete}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Finish Setup
          </button>
        </div>
      </div>
    </div>
  );
}