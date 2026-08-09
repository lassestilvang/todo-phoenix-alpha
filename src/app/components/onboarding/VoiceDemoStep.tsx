'use client';

import { useState, useEffect } from 'react';
import { useOnboarding } from '@/lib/onboarding/useOnboarding';
import { TaskFormDialog } from '@/components/tasks/task-form-dialog';
import type { TaskFormData } from '@/lib/types';

export function VoiceDemoStep() {
  const { nextStep, state } = useOnboarding();
  const [showVoiceDemo, setShowVoiceDemo] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);

  // Check voice support on mount
  useEffect(() => {
    const hasVoiceSupport = (
      'webkitSpeechRecognition' in window ||
      'SpeechRecognition' in window
    );
    setVoiceSupported(hasVoiceSupport);
  }, []);

  const handleVoiceStart = () => {
    setShowVoiceDemo(true);

    // Simulate voice recognition
    const demoPhrases = [
      'Remind me to finish project proposal tomorrow at 3pm',
      'Call John for project update',
      'Review quarterly report',
      'Buy groceries for weekend dinner'
    ];

    let phraseIndex = 0;
    const interval = setInterval(() => {
      setTranscript(demoPhrases[phraseIndex % demoPhrases.length]);
      phraseIndex++;
      if (phraseIndex > 3) clearInterval(interval);
    }, 1500);
  };

  const handleContinue = () => {
    if (voiceSupported) {
      setShowVoiceDemo(false);
      nextStep();
    } else {
      // Show system prompt about browser support
      setShowVoiceDemo(false);
      setTimeout(() => nextStep(), 1000);
    }
  };

  return (
    <div className="onboarding-step voice-demo-step flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <div className="text-5xl">🎤</div>
          <h1 className="text-3xl font-bold text-foreground">
            Voice Input Demo
          </h1>
          <p className="text-muted-foreground text-lg">
            Experience how you can create tasks by speaking naturally.
            See how Todo Phoenix understands complex commands.
          </p>
        </div>

        <div className="bg-card rounded-xl border border-input p-8 space-y-6">
          {voiceSupported ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Speak these commands to test:
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                  <div className="text-xl">🎤</div>
                  <div className="text-sm">
                    "Remind me to call John tomorrow at 3pm"
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                  <div className="text-xl">🎤</div>
                  <div className="text-sm">
                    "Finish quarterly report by Friday"
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                  <div className="text-xl">🎤</div>
                  <div className="text-sm">
                    "Schedule team meeting for next Monday"
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Note: Your browser needs Chrome or Edge for voice support
              </div>
              <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
                Tip: Try Chrome, Edge, or Safari for best voice experience
              </div>
            </div>
          )}

          {showVoiceDemo && (
            <div className="space-y-4 animate-pulse">
              <div className="text-sm text-muted-foreground font-medium">
                Listening...
              </div>
              <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                <div className="text-sm text-primary font-mono">
                  {transcript || '...'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center space-x-4">
          <button
            onClick={handleVoiceStart}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center space-x-2"
          >
            <span>🎤</span>
            <span>Start Voice Demo</span>
          </button>
          <button
            onClick={handleContinue}
            className="px-6 py-3 border border-input hover:bg-accent rounded-lg font-medium"
          >
            Continue (Skip)
          </button>
        </div>
      </div>
    </div>
  );
}