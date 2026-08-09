"use strict";

import { TaskParser } from '../nlp/task-parser';

export interface VoiceCommand {
  type: 'create_task' | 'update_task' | 'query_tasks' | 'set_reminder' | 'delete_task' | 'navigate' | 'help';
  entities: VoiceEntities;
  confidence: number;
  originalText: string;
}

export interface VoiceEntities {
  taskName?: string;
  description?: string;
  deadline?: Date;
  priority?: 'high' | 'medium' | 'low' | 'none';
  duration?: number;
  listId?: number;
  taskId?: number;
  reminderTime?: Date;
  query?: string;
  [key: string]: any;
}

export interface VoiceIntent {
  action: 'create' | 'update' | 'delete' | 'query' | 'navigate' | 'reminder';
  target: 'task' | 'list' | 'project' | 'timer';
  entities: VoiceEntities;
}

export class VoiceEngine {
  private recognition: any;
  private synthesis: SpeechSynthesis;
  private isListening = false;
  private confidenceThreshold = 0.7;
  private commandHistory: VoiceCommand[] = [];
  private contextStore: Map<string, any> = new Map();

  constructor() {
    this.initializeSpeechRecognition();
    this.initializeSpeechSynthesis();
    this.setupEventListeners();
  }

  private initializeSpeechRecognition() {
    if (typeof window === 'undefined' || !('webkitSpeechRecognition' in window)) {
      console.warn('Speech recognition not supported');
      return;
    }

    this.recognition = new (window as any).webkitSpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 3;
  }

  private initializeSpeechSynthesis() {
    this.synthesis = window.speechSynthesis;
    this.synthesis.cancel();
  }

  private setupEventListeners() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('Voice recognition started');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('Voice recognition ended');
    };

    this.recognition.onerror = (event: any) => {
      console.error('Voice recognition error:', event.error);
      this.isListening = false;
    };

    this.recognition.onresult = (event: any) => {
      this.handleRecognitionResult(event);
    };
  }

  private handleRecognitionResult(event: any) {
    const transcript = Array.from(event.results)
      .map((result: any) => result[0].text)
      .join('');

    const isFinal = event.results[event.results.length - 1].isFinal;

    if (isFinal) {
      this.processVoiceCommand(transcript);
    } else {
      // Handle interim results for UI feedback
      console.log('Interim transcript:', transcript);
    }
  }

  public async processVoiceCommand(transcript: string): Promise<VoiceCommand | null> {
    try {
      // Parse the command using NLP
      const intent = await this.parseCommand(transcript);

      // Create command object
      const command: VoiceCommand = {
        type: intent.action === 'create' && intent.target === 'task' ? 'create_task' :
              intent.action === 'update' && intent.target === 'task' ? 'update_task' :
              intent.action === 'delete' && intent.target === 'task' ? 'delete_task' :
              intent.action === 'query' ? 'query_tasks' :
              intent.action === 'reminder' ? 'set_reminder' :
              intent.action === 'navigate' ? 'navigate' : 'help',
        entities: intent.entities,
        confidence: this.calculateConfidence(intent, transcript),
        originalText: transcript,
      };

      // Add to history
      this.commandHistory.push(command);

      // Execute if confidence is high enough
      if (command.confidence >= this.confidenceThreshold) {
        await this.executeCommand(command);
      } else {
        this.speak(`I didn't quite catch that. Could you repeat?`);
      }

      return command;
    } catch (error) {
      console.error('Error processing voice command:', error);
      this.speak(`Sorry, I encountered an error processing your command.`);
      return null;
    }
  }

  private async parseCommand(transcript: string): Promise<VoiceIntent> {
    // Use the existing TaskParser for natural language understanding
    const taskParser = TaskParser.parse(transcript);

    // Extract intent from the parsed task
    const intent: VoiceIntent = {
      action: 'create', // Default
      target: 'task',   // Default
      entities: {}
    };

    // Enhanced parsing logic
    const lowerTranscript = transcript.toLowerCase();n
    if (lowerTranscript.includes('create') || lowerTranscript.includes('add') || lowerTranscript.includes('new')) {
      intent.action = 'create';
    } else if (lowerTranscript.includes('update') || lowerTranscript.includes('modify') || lowerTranscript.includes('change')) {
      intent.action = 'update';
    } else if (lowerTranscript.includes('delete') || lowerTranscript.includes('remove') || lowerTranscript.includes('finish')) {
      intent.action = 'delete';
    } else if (lowerTranscript.includes('find') || lowerTranscript.includes('search') || lowerTranscript.includes('show') || lowerTranscript.includes('what')) {
      intent.action = 'query';
    }

    if (lowerTranscript.includes('task')) {
      intent.target = 'task';
    } else if (lowerTranscript.includes('list')) {
      intent.target = 'list';
    } else if (lowerTranscript.includes('project')) {
      intent.target = 'project';
    }

    // Map parsed task data to entities
    if (taskParser.name) {
      intent.entities.taskName = taskParser.name;
    }
    if (taskParser.description) {
      intent.entities.description = taskParser.description;
    }
    if (taskParser.deadline) {
      intent.entities.deadline = taskParser.deadline;
    }
    if (taskParser.priority) {
      intent.entities.priority = taskParser.priority;
    }
    if (taskParser.estimate_minutes) {
      intent.entities.duration = taskParser.estimate_minutes;
    }

    // Handle time expressions in the original transcript
    const timeRegex = /(?:tomorrow|today|next (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in (?:morning|afternoon|evening)|at \d{1,2}(?::\d{2})?\s?(?:am|pm)?)/i;
    const timeMatch = transcript.match(timeRegex);
    if (timeMatch) {
      intent.entities.timeExpression = timeMatch[0];
    }

    return intent;
  }

  private calculateConfidence(intent: VoiceIntent, transcript: string): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence based on keywords
    const lowerTranscript = transcript.toLowerCase();
    if (lowerTranscript.includes('task')) confidence += 0.2;
    if (lowerTranscript.includes('deadline') || lowerTranscript.includes('due') || lowerTranscript.includes('by')) confidence += 0.15;
    if (lowerTranscript.includes('priority') || lowerTranscript.includes('important') || lowerTranscript.includes('urgent')) confidence += 0.15;
    if (lowerTranscript.includes('today') || lowerTranscript.includes('tomorrow')) confidence += 0.1;
    if (lowerTranscript.includes('call') || lowerTranscript.includes('meet') || lowerTranscript.includes('email')) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  public startListening(): void {
    if (!this.recognition) {
      this.speak('Voice recognition is not supported in your browser');
      return;
    }

    if (this.isListening) {
      this.stopListening();
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  public speak(text: string, options?: { rate?: number; pitch?: number; volume?: number }): void {
    if (!this.synthesis) {
      console.warn('Speech synthesis not supported');
      return;
    }

    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    if (options?.rate) utterance.rate = options.rate;
    if (options?.pitch) utterance.pitch = options.pitch;
    if (options?.volume) utterance.volume = options.volume;

    // Use a more natural voice
    const voices = this.synthesis.getVoices();
    const preferredVoice = voices.find(voice => voice.name.includes('Google') || voice.name.includes('Samantha'));
    if (preferredVoice) utterance.voice = preferredVoice;

    this.synthesis.speak(utterance);
  }

  public isCurrentlyListening(): boolean {
    return this.isListening;
  }

  public getCommandHistory(): VoiceCommand[] {
    return [...this.commandHistory];
  }

  public clearHistory(): void {
    this.commandHistory = [];
  }

  private async executeCommand(command: VoiceCommand): Promise<void> {
    console.log('Executing command:', command);

    switch (command.type) {
      case 'create_task':
        await this.handleCreateTaskCommand(command);
        break;
      case 'update_task':
        await this.handleUpdateTaskCommand(command);
        break;
      case 'delete_task':
        await this.handleDeleteTaskCommand(command);
        break;
      case 'query_tasks':
        await this.handleQueryTasksCommand(command);
        break;
      case 'set_reminder':
        await this.handleReminderCommand(command);
        break;
      default:
        this.speak(`I don't know how to handle that command: ${command.type}`);
    }
  }

  private async handleCreateTaskCommand(command: VoiceCommand): Promise<void> {
    try {
      const taskData = {
        name: command.entities.taskName || 'Untitled Task',
        description: command.entities.description,
        deadline: command.entities.deadline,
        priority: command.entities.priority,
        estimate_minutes: command.entities.duration,
        list_id: command.entities.listId || 1,
      };

      // Make API call to create task
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      if (response.ok) {
        const task = await response.json();
        this.speak(`Created task: ${task.name}${command.entities.deadline ? ` due ${new Date(command.entities.deadline).toLocaleDateString()}` : ''}`);
      } else {
        throw new Error('Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      this.speak('Sorry, I was unable to create that task. Please try again.');
    }
  }

  private async handleUpdateTaskCommand(command: VoiceCommand): Promise<void> {
    // Implementation for updating tasks
    this.speak('Task update functionality is being developed');
  }

  private async handleDeleteTaskCommand(command: VoiceCommand): Promise<void> {
    // Implementation for deleting tasks
    this.speak('Task deletion functionality is being developed');
  }

  private async handleQueryTasksCommand(command: VoiceCommand): Promise<void> {
    // Implementation for querying tasks
    this.speak('Task query functionality is being developed');
  }

  private async handleReminderCommand(command: VoiceCommand): Promise<void> {
    // Implementation for setting reminders
    this.speak('Reminder functionality is being developed');
  }

  public dispose(): void {
    this.stopListening();
    this.synthesis.cancel();
  }
}

// Singleton instance
let voiceEngineInstance: VoiceEngine | null = null;

export function getVoiceEngine(): VoiceEngine {
  if (!voiceEngineInstance) {
    voiceEngineInstance = new VoiceEngine();
  }
  return voiceEngineInstance;
}

export type { VoiceCommand, VoiceIntent, VoiceEntities };