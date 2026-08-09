'use client';

import { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceInput } from '@/lib/hooks/useVoiceInput';

interface VoiceInputButtonProps {
  onTaskCreated?: (task: any) => void;
  onTranscript?: (text: string) => void;
  className?: string;
  showTranscript?: boolean;
  autoStop?: boolean;
}

export function VoiceInputButton({
  onTaskCreated,
  onTranscript,
  className = '',
  showTranscript = true,
  autoStop = true,
}: VoiceInputButtonProps) {
  const {
    isListening,
    lastCommand,
    isProcessing,
    error,
    startListening,
    stopListening,
    speak,
    isSupported,
  } = useVoiceInput();

  const [showTranscriptText, setShowTranscriptText] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Handle listening state changes
  useEffect(() => {
    if (isListening && !showTranscriptText) {
      setShowTranscriptText(true);
      setTranscript('Listening...');
    }
  }, [isListening]);

  // Handle command results
  useEffect(() => {
    if (lastCommand) {
      setLastResult(lastCommand.originalText);
      if (onTranscript) {
        onTranscript(lastCommand.originalText);
      }

      // Speak confirmation for successful commands
      if (lastCommand.type === 'create_task' && lastCommand.entities.taskName) {
        speak(`Created "${lastCommand.entities.taskName}"`);
        if (onTaskCreated) {
          // Notify parent of successful creation
          onTaskCreated({ ...lastCommand.entities, voiceGenerated: true });
        }
      }

      // Auto-hide transcript after a delay
      if (autoStop) {
        setTimeout(() => {
          setShowTranscriptText(false);
        }, 5000);
      }
    }
  }, [lastCommand, onTranscript, onTaskCreated, speak, autoStop]);

  const handleClick = () => {
    if (!isSupported) {
      speak('Voice input is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <Button
        variant="outline"
        className={`${className} opacity-50`}
        disabled
        title="Voice input not supported in this browser"
      >
        <MicOff className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className={`relative inline-flex ${className}`}>
      <Button
        onClick={handleClick}
        variant={isListening ? 'default' : 'outline'}
        className={`
          transition-all duration-200
          ${isListening ? 'bg-red-500 text-white animate-pulse ring-2 ring-red-500/50' : ''}
          ${isProcessing ? 'opacity-75 cursor-wait' : ''}
        `}
        disabled={isProcessing}
        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isListening ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {/* Transcript Display */}
      {showTranscript && showTranscriptText && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 px-3 py-2 bg-popover border border-border rounded-lg shadow-lg text-sm z-50 animate-fade-in">
          <div className="flex items-center space-x-2 mb-1">
            <Mic className="h-3 w-3 text-primary" />
            <span className="font-medium">Voice Input</span>
          </div>
          <p className="text-foreground">{transcript || lastResult || 'Speak now...'}</p>
          {error && (
            <p className="text-red-500 text-xs mt-1">{error}</p>
          )}
        </div>
      )}

      {/* Status Indicator */}
      {lastCommand && !isProcessing && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-popover border border-border rounded-lg shadow-lg text-xs z-50 animate-fade-in">
          {lastCommand.type === 'create_task' ? (
            <span className="flex items-center space-x-1 text-green-600">
              <Check className="h-3 w-3" />
              <span>Created: {lastCommand.entities.taskName}</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-muted-foreground">
              <X className="h-3 w-3" />
              <span>Command not recognized</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}