'use client';

import { useEffect, useState } from 'react';
import { useOnboarding } from '@/lib/onboarding/useOnboarding';

export function ShortcutsStep() {
  const { nextStep, updatePreferences, state } = useOnboarding();
  const [showTips, setShowTips] = useState(false);

  const shortcuts = [
    { key: 'Ctrl+N', description: 'Create new task', category: 'navigation' },
    { key: 'Escape', description: 'Close dialogs / cancel', category: 'navigation' },
    { key: 'Ctrl+F', description: 'Search tasks', category: 'search' },
    { key: 'Ctrl+S', description: 'Save current task', category: 'actions' },
    { key: 'Ctrl+E', description: 'Edit selected task', category: 'actions' },
    { key: 'Ctrl+/', description: 'Toggle comments view', category: 'actions' },
    { key: 'Tab', description: 'Navigate between tasks', category: 'navigation' },
    { key: 'Enter', description: 'Complete/Expand task', category: 'actions' },
    { key: 'Ctrl+D', description: 'Toggle dark mode', category: 'view' },
    { key: 'Ctrl+T', description: 'Open task timer', category: 'actions' },
  ];

  const handleEnableTips = () => {
    updatePreferences({ keyboardShortcutsTips: true });
    setShowTips(true);
    setTimeout(() => nextStep(), 1000);
  };

  const handleSkipTips = () => {
    updatePreferences({ keyboardShortcutsTips: false });
    nextStep();
  };

  // Try the shortcut in a safe demo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        setShowTips(true);
        setTimeout(() => setShowTips(false), 2000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="onboarding-step shortcuts-step flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-8">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-4">
          <div className="text-5xl">⌨️</div>
          <h1 className="text-3xl font-bold text-foreground">
            Keyboard Shortcuts
          </h1>
          <p className="text-muted-foreground text-lg">
            Navigate Todo Phoenix faster with keyboard shortcuts.
            {showTips && (
              <span className="ml-2 text-primary font-medium">
                (Try pressing Ctrl+N!)
              </span>
            )}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-input p-6">
          <h3 className="font-semibold mb-4">Essential Shortcuts</h3>
          <div className="grid gap-3">
            {shortcuts.map((sc) => (
              <div
                key={sc.key}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <kbd className="px-3 py-1.5 bg-background border border-input rounded-md font-mono text-sm">
                    {sc.key}
                  </kbd>
                  <span className="text-sm">{sc.description}</span>
                </div>
                <span className="text-xs text-muted-foreground capitalize">
                  {sc.category}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Would you like shortcut tips to appear while using the app?
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={handleEnableTips}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Enable Tips
            </button>
            <button
              onClick={handleSkipTips}
              className="px-6 py-3 border border-input hover:bg-accent rounded-lg font-medium"
            >
              Skip Tips
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
