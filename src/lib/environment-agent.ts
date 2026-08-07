/**
 * Environment Agent - Detects user context and system state
 * Provides environmental signals to other agents and the AgentOS orchestrator
 */

import { create } from 'zustand';

export type EnvironmentContext =
  | 'focus_mode'
  | 'meeting'
  | 'deep_work'
  | 'interrupt'
  | 'idle'
  | 'commute'
  | 'break'
  | 'sleep';

export interface EnvironmentState {
  currentContext: EnvironmentContext;
  confidence: number; // 0-1
  signals: Record<string, any>;
  systemState: {
    batteryLevel?: number;
    batteryCharging: boolean;
    networkType?: 'wifi' | 'ethernet' | 'cellular' | 'offline';
    cpuUsage: number;
    memoryUsage: number;
    screenActive: boolean;
    inputActive: boolean;
    lastInputTime: number;
  };
  userPreferences: {
    workHours: { start: number; end: number };
    focusModes: string[];
    notificationSensitivity: 'low' | 'medium' | 'high';
  };
}

export interface EnvironmentAgentConfig {
  pollingIntervalMs: number;
  confidenceThreshold: number;
  autoDetectMeetings: boolean;
  autoDetectFocus: boolean;
}

const defaultConfig: EnvironmentAgentConfig = {
  pollingIntervalMs: 30000,
  confidenceThreshold: 0.7,
  autoDetectMeetings: true,
  autoDetectFocus: true,
};

// Environment Agent Store
export const useEnvironmentAgent = create<{
  state: EnvironmentState;
  config: EnvironmentAgentConfig;
  isMonitoring: boolean;
  updateContext: (context: Partial<EnvironmentState>) => void;
  detectContext: () => EnvironmentContext;
  getCurrentContext: () => { context: EnvironmentContext; confidence: number; signals: Record<string, any> };
  start: () => void;
  stop: () => void;
}>((set, get) => ({
  state: {
    currentContext: 'idle',
    confidence: 0.5,
    signals: {},
    systemState: {
      batteryCharging: true,
      cpuUsage: 0,
      memoryUsage: 0,
      screenActive: true,
      inputActive: true,
      lastInputTime: Date.now(),
    },
    userPreferences: {
      workHours: { start: 9, end: 17 },
      focusModes: ['deep-work', 'meetings'],
      notificationSensitivity: 'medium',
    },
  },

  config: defaultConfig,
  isMonitoring: false,

  updateContext: (updates) => {
    set(state => ({
      state: {
        currentContext: 'idle',
        confidence: 0.8,
        signals: {},
        systemState: {
          batteryCharging: true,
          cpuUsage: 0,
          memoryUsage: 0,
          screenActive: true,
          inputActive: true,
          lastInputTime: Date.now(),
        },
        userPreferences: {
          workHours: { start: 9, end: 17 },
          focusModes: ['deep-work', 'meetings'],
          notificationSensitivity: 'medium',
        },
        ...updates,
      },
    }));
  },

  detectContext: () => {
    const now = new Date();
    const hour = now.getHours();
    const state = get().state;
    const prefs = state.userPreferences;

    let context: EnvironmentContext = 'idle';
    let confidence = 0.5;
    const signals: Record<string, any> = {};

    // Time-based context
    if (hour >= prefs.workHours.start && hour < prefs.workHours.end) {
      context = 'work';
      confidence = 0.6;
      signals.workHours = true;
    } else {
      context = 'break';
      confidence = 0.5;
      signals.afterWorkHours = true;
    }

    // Screen/input activity
    const timeSinceInput = Date.now() - state.systemState.lastInputTime;
    if (timeSinceInput > 300000) { // 5 minutes idle
      context = 'idle';
      confidence = Math.min(1, timeSinceInput / 60000);
      signals.idle = true;
      signals.idleDuration = timeSinceInput;
    } else if (timeSinceInput > 60000) { // 1 minute inactive
      context = 'distracted';
      confidence = 0.4;
      signals.lowActivity = true;
    }

    // Battery state
    if (state.systemState.batteryLevel !== undefined &&
        state.systemState.batteryLevel < 0.2 &&
        !state.systemState.batteryCharging) {
      context = 'break';
      confidence = 0.8;
      signals.lowBattery = true;
    }

    get().updateContext({ currentContext: context, confidence, signals });
    return context;
  },

  getCurrentContext: () => {
    const state = get().state;
    return {
      context: state.currentContext,
      confidence: state.confidence,
      signals: state.signals,
    };
  },

  start: () => {
    if (get().isMonitoring) return;
    set({ isMonitoring: true });
    get().detectContext();
  },

  stop: () => {
    set({ isMonitoring: false });
  },
}));

export function getEnvironmentAgent() {
  return {
    getCurrentContext: useEnvironmentAgent.getState().getCurrentContext,
    detectContext: useEnvironmentAgent.getState().detectContext,
    updateContext: useEnvironmentAgent.getState().updateContext,
  };
}