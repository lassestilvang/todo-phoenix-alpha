'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getVoiceEngine, VoiceCommand } from '@/lib/voice/VoiceEngine';

export function useVoiceInput() {
  const voiceEngine = useRef(getVoiceEngine());
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startListening = useCallback(() => {
    if (!voiceEngine.current) return;

    voiceEngine.current.startListening();
    setIsListening(true);
    setError(null);
  }, []);

  const stopListening = useCallback(() => {
    if (!voiceEngine.current) return;

    voiceEngine.current.stopListening();
    setIsListening(false);
  }, []);

  // Listen for voice command results
  useEffect(() => {
    if (!voiceEngine.current) return;

    const commandHandler = (command: VoiceCommand) => {
      setLastCommand(command);
      setIsProcessing(false);
    };

    const errorHandler = (err: Error) => {
      setError(err.message);
      setIsProcessing(false);
      setIsListening(false);
    };

    // We need to intercept the command execution
    // For now, we'll use polling since we modified VoiceEngine to store history
    const interval = setInterval(() => {
      const history = voiceEngine.current.getCommandHistory();
      if (history.length > 0) {
        const latest = history[history.length - 1];
        if (latest !== lastCommand) {
          setLastCommand(latest);
          setIsProcessing(false);
        }
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [lastCommand]);

  // Process command when isListening changes (start/stop)
  useEffect(() => {
    if (!isListening && lastCommand) {
      // Command was just processed
      setIsProcessing(false);
    }
  }, [isListening, lastCommand]);

  const speak = useCallback((text: string) => {
    voiceEngine.current.speak(text);
  }, []);

  const reset = useCallback(() => {
    voiceEngine.current.clearHistory();
    setLastCommand(null);
    setError(null);
    setIsProcessing(false);
  }, []);

  return {
    isListening,
    lastCommand,
    isProcessing,
    error,
    startListening,
    stopListening,
    speak,
    reset,
    isSupported: typeof window !== 'undefined' && 'webkitSpeechRecognition' in window,
  };
}