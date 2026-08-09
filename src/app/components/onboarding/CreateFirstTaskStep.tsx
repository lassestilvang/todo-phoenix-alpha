'use client';

import { useState } from 'react';
import { useOnboarding } from '@/lib/onboarding/useOnboarding';
import { TaskFormDialog } from '@/components/tasks/task-form-dialog';
import type { TaskFormData } from '@/lib/types';

export function CreateFirstTaskStep() {
  const { nextStep, state } = useOnboarding();
  const [showDialog, setShowDialog] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);

  const handleSave = async (data: TaskFormData) => {
    // The actual save happens in the parent page
    // For onboarding, we just track that user tried
    setTaskCreated(true);
    setShowDialog(false);

    // Advance after brief delay
    setTimeout(() => nextStep(), 800);
  };

  const handleOpenVoice = () => {
    setShowVoice(true);
    setShowDialog(true);
  };

  const handleOpenManual = () => {
    setShowVoice(false);
    setShowDialog(true);
  };

  return (
    <div className="onboarding-step create-task-step flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <div className="space-y-4">
          <div className="text-5xl">✨</div>
          <h1 className="text-3xl font-bold text-foreground">
            Create Your First Task
          </h1>
          <p className="text-muted-foreground">
            Try adding a task using natural language or manual entry.
            We'll guide you through both ways.
          </p>
        </div>

        {!taskCreated ? (
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={handleOpenManual}
              className="group relative p-6 border border-input rounded-xl hover:border-primary/50 transition-colors"
            >
              <div className="text-3xl mb-2">📝</div>
              <h3 className="font-semibold text-lg">Manual Entry</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Type your task with full control
              </p>
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
            </button>

            <button
              onClick={handleOpenVoice}
              className="group relative p-6 border border-input rounded-xl hover:border-primary/50 transition-colors"
            >
              <div className="text-3xl mb-2">🎤</div>
              <h3 className="font-semibold text-lg">Voice Input</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Speak naturally: "Remind me to call John tomorrow at 3pm"
              </p>
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-4xl text-green-500">✅</div>
            <h2 className="text-2xl font-bold text-foreground">Task Created!</h2>
            <p className="text-muted-foreground">
              Great job! Let's explore the other features.
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Press Escape to skip | Ctrl+N to create tasks anytime
        </div>
      </div>

      {showDialog && (
        <TaskFormDialog
          open={showDialog}
          onClose={() => setShowDialog(false)}
          onSave={handleSave}
          mode="create"
          lists={[]}
          labels={[]}
        />
      )}
    </div>
  );
}