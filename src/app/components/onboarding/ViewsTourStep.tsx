'use client';

import { useState } from 'react';
import { useOnboarding } from '@/lib/onboarding/useOnboarding';

export function ViewsTourStep() {
  const { nextStep, updatePreferences, state } = useOnboarding();
  const [selectedView, setSelectedView] = useState('today');

  const views = [
    { id: 'today', name: 'Today', icon: '📅', description: 'Tasks due today' },
    { id: 'next_7_days', name: 'Next 7 Days', icon: '📆', description: 'Upcoming tasks this week' },
    { id: 'upcoming', name: 'Upcoming', icon: '�', description: 'All future tasks' },
    { id: 'all', name: 'All Tasks', icon: '📋', description: 'Everything across all lists' },
  ];

  const handleContinue = () => {
    updatePreferences({ preferredView: selectedView as any });
    nextStep();
  };

  return (
    <div className="onboarding-step views-tour-step flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-4">
          <div className="text-5xl">📊</div>
          <h1 className="text-3xl font-bold text-foreground">
            Explore Views
          </h1>
          <p className="text-muted-foreground text-lg">
            Todo Phoenix offers multiple views to help you focus on what's
            most important. Click on a view to learn more about it.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => setSelectedView(view.id)}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedView === view.id
                  ? 'border-primary bg-primary/5 shadow-lg scale-105'
                  : 'border-input hover:border-primary/50 hover:scale-102'
              }`}
            >
              <div className="text-3xl mb-3">{view.icon}</div>
              <h3 className="font-semibold text-lg">{view.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {view.description}
              </p>
              {selectedView === view.id && (
                <div className="mt-2 text-xs font-medium text-primary">
                  Selected as default ✓
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Your default view: <strong>{views.find(v => v.id === selectedView)?.name}</strong>
          </p>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleContinue}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
