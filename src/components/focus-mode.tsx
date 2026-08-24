"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Settings,
  Clock,
  Brain,
  Music,
  SkipBack,
  SkipForward,
  Bell,
  CheckCircle,
  XCircle,
  Settings2,
  ArrowUp,
  ArrowDown,
  Coffee,
  Bed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useTimeTracker } from "@/lib/hooks/use-time-tracker";

interface FocusSession {
  id: number;
  taskId: number;
  startTime: Date;
  endTime?: Date;
  duration: number; // in minutes
  type: 'work' | 'short_break' | 'long_break';
  completed: boolean;
}

interface AmbientSound {
  id: string;
  name: string;
  icon: string;
  url: string;
  category: 'nature' | 'white_noise' | 'ambient' | 'music';
}

const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: 'rain', name: 'Rain', icon: '🌧️', url: '/sounds/rain.mp3', category: 'nature' },
  { id: 'forest', name: 'Forest', icon: '🌲', url: '/sounds/forest.mp3', category: 'nature' },
  { id: 'ocean', name: 'Ocean Waves', icon: '🌊', url: '/sounds/ocean.mp3', category: 'nature' },
  { id: 'fireplace', name: 'Fireplace', icon: '🔥', url: '/sounds/fireplace.mp3', category: 'ambient' },
  { id: 'coffee_shop', name: 'Coffee Shop', icon: '☕', url: '/sounds/coffee-shop.mp3', category: 'ambient' },
  { id: 'white_noise', name: 'White Noise', icon: '📻', url: '/sounds/white-noise.mp3', category: 'white_noise' },
  { id: 'pink_noise', name: 'Pink Noise', icon: '📻', url: '/sounds/pink-noise.mp3', category: 'white_noise' },
  { id: 'brown_noise', name: 'Brown Noise', icon: '📻', url: '/sounds/brown-noise.mp3', category: 'white_noise' },
  { id: 'lofi', name: 'Lo-fi Beats', icon: '🎵', url: '/sounds/lofi.mp3', category: 'music' },
  { id: 'classical', name: 'Classical', icon: '🎻', url: '/sounds/classical.mp3', category: 'music' },
];

const DEFAULT_SETTINGS = {
  workDuration: 25, // minutes
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4, // after 4 work sessions
  autoStartBreaks: false,
  autoStartWork: false,
  soundEnabled: true,
  soundVolume: 0.5,
  selectedSound: 'rain',
  notificationsEnabled: true,
};

export function FocusMode({ taskId }: { taskId?: number }) {
  const [isActive, setIsActive] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'work' | 'short_break' | 'long_break'>('work');
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_SETTINGS.workDuration * 60);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [selectedSound, setSelectedSound] = useState<string>(DEFAULT_SETTINGS.selectedSound);
  const [soundVolume, setSoundVolume] = useState(DEFAULT_SETTINGS.soundVolume);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [sessions, setSessions] = useState<FocusSession[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const phaseStartRef = useRef<Date>(new Date());
  const workSessionsCompleted = useRef(0);

  const { isRunning, elapsedSeconds, startTimer, stopTimer, resetTimer, formatTime } = useTimeTracker(taskId || 0);

  // Initialize audio
  useEffect(() => {
    const sound = AMBIENT_SOUNDS.find(s => s.id === selectedSound);
    if (sound) {
      audioRef.current = new Audio(sound.url);
      audioRef.current.loop = true;
      audioRef.current.volume = soundVolume;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [selectedSound]);

  // Update audio volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = soundVolume;
    }
  }, [soundVolume]);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('focus_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse focus settings');
      }
    }

    const savedSound = localStorage.getItem('focus_sound');
    if (savedSound) {
      setSelectedSound(savedSound);
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('focus_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('focus_sound', selectedSound);
  }, [selectedSound]);

  // Timer logic
  const startFocusSession = useCallback(() => {
    setIsActive(true);
    phaseStartRef.current = new Date();

    if (settings.soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {
        console.warn('Could not play ambient sound');
      });
      setIsSoundPlaying(true);
    }

    if (taskId) {
      startTimer();
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handlePhaseComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [settings.soundEnabled, taskId, startTimer]);

  const pauseFocusSession = useCallback(() => {
    setIsActive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      setIsSoundPlaying(false);
    }
    if (taskId) {
      stopTimer();
    }
  }, [taskId, stopTimer]);

  const stopFocusSession = useCallback(() => {
    setIsActive(false);
    setCurrentPhase('work');
    setTimeRemaining(settings.workDuration * 60);
    workSessionsCompleted.current = 0;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSoundPlaying(false);
    }
    if (taskId) {
      stopTimer();
      resetTimer();
    }
  }, [settings.workDuration, taskId, stopTimer, resetTimer]);

  const handlePhaseComplete = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const session: FocusSession = {
      id: Date.now(),
      taskId: taskId || 0,
      startTime: phaseStartRef.current,
      endTime: new Date(),
      duration: Math.floor((new Date().getTime() - phaseStartRef.current.getTime()) / 60000),
      type: currentPhase,
      completed: true,
    };

    setSessions(prev => [...prev, session]);

    if (currentPhase === 'work') {
      workSessionsCompleted.current += 1;
      setCompletedSessions(prev => prev + 1);

      if (taskId) {
        // Time tracking is already running via useTimeTracker
      }

      // Check if it's time for a long break
      if (workSessionsCompleted.current % settings.longBreakInterval === 0) {
        setCurrentPhase('long_break');
        setTimeRemaining(settings.longBreakDuration * 60);
        if (settings.notificationsEnabled) {
          toast.success('Work session complete! Time for a long break.', {
            icon: <Bell className="h-5 w-5" />,
          });
        }
      } else {
        setCurrentPhase('short_break');
        setTimeRemaining(settings.shortBreakDuration * 60);
        if (settings.notificationsEnabled) {
          toast.success('Work session complete! Time for a short break.', {
            icon: <Bell className="h-5 w-5" />,
          });
        }
      }

      if (settings.autoStartBreaks) {
        setTimeout(() => startFocusSession(), 1000);
      }
    } else {
      // Break completed
      setCurrentPhase('work');
      setTimeRemaining(settings.workDuration * 60);
      if (settings.notificationsEnabled) {
        toast.info('Break over! Ready to focus?', {
          icon: <Brain className="h-5 w-5" />,
        });
      }

      if (settings.autoStartWork) {
        setTimeout(() => startFocusSession(), 1000);
      }
    }

    // Play notification sound
    const notification = new Audio('/sounds/notification.mp3');
    notification.volume = 0.3;
    notification.play().catch(() => {});
  }, [currentPhase, settings, taskId, startFocusSession]);

  const toggleSound = useCallback(() => {
    if (audioRef.current) {
      if (isSoundPlaying) {
        audioRef.current.pause();
        setIsSoundPlaying(false);
      } else {
        audioRef.current.play().catch(() => {});
        setIsSoundPlaying(true);
      }
    }
  }, [isSoundPlaying]);

  const handleSoundSelect = useCallback((soundId: string) => {
    setSelectedSound(soundId);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const sound = AMBIENT_SOUNDS.find(s => s.id === soundId);
    if (sound) {
      audioRef.current = new Audio(sound.url);
      audioRef.current.loop = true;
      audioRef.current.volume = soundVolume;
      if (isSoundPlaying || isActive) {
        audioRef.current.play().catch(() => {});
        setIsSoundPlaying(true);
      }
    }
  }, [soundVolume, isSoundPlaying, isActive]);

  const handleVolumeChange = useCallback((value: number[]) => {
    setSoundVolume(value[0]);
  }, []);

  const handleSettingsChange = useCallback((key: keyof typeof settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));

    // If we're in the work phase and work duration changed, update timer
    if (key === 'workDuration' && currentPhase === 'work' && !isActive) {
      setTimeRemaining(value * 60);
    }
  }, [currentPhase, isActive]);

  const formatTimeDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((settings.workDuration * 60 - timeRemaining) / (settings.workDuration * 60)) * 100;

  return (
    <div className="space-y-6">
      {/* Main Timer Card */}
      <Card className="relative overflow-hidden">
        <CardContent className="p-6 pt-8">
          {/* Phase Indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Badge
              variant={currentPhase === 'work' ? 'default' : currentPhase === 'short_break' ? 'secondary' : 'outline'}
              className="text-sm px-3 py-1"
            >
              {currentPhase === 'work' && <Brain className="h-3 w-3 mr-1" />}
              {currentPhase === 'short_break' && <Coffee className="h-3 w-3 mr-1" />}
              {currentPhase === 'long_break' && <Bed className="h-3 w-3 mr-1" />}
              {currentPhase === 'work' ? 'Focus' : currentPhase === 'short_break' ? 'Short Break' : 'Long Break'}
            </Badge>
          </div>

          {/* Timer Display */}
          <div className="relative flex flex-col items-center">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/30"
                />
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 88}
                  strokeDashoffset={2 * Math.PI * 88 * (1 - progress / 100)}
                  strokeLinecap="round"
                  className={cn(
                    "transition-all duration-1000",
                    currentPhase === 'work' ? 'text-primary' :
                    currentPhase === 'short_break' ? 'text-green-500' : 'text-blue-500'
                  )}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-5xl font-mono font-light tabular-nums">
                  {formatTimeDisplay(timeRemaining)}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mt-8">
            {!isActive ? (
              <>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={stopFocusSession}
                  disabled={timeRemaining === settings.workDuration * 60 && currentPhase === 'work'}
                  className="h-12 w-12"
                >
                  <Square className="h-6 w-6" />
                </Button>
                <Button
                  size="default"
                  className="h-16 w-16 rounded-full"
                  onClick={startFocusSession}
                >
                  <Play className="h-8 w-8 ml-1" />
                </Button>
              </>
            ) : (
              <Button
                size="default"
                className="h-16 w-16 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
                onClick={pauseFocusSession}
              >
                <Pause className="h-8 w-8" />
              </Button>
            )}
          </div>

          {/* Session Counter */}
          <div className="flex items-center justify-center gap-6 mt-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{completedSessions} completed</span>
            </div>
            {taskId && isRunning && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Tracked: {formatTime(elapsedSeconds)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ambient Sounds */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Ambient Sounds
          </CardTitle>
          <Switch
            checked={settings.soundEnabled}
            onCheckedChange={(checked) => handleSettingsChange('soundEnabled', checked)}
          />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Volume Control */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSound}
                className={cn(isSoundPlaying ? 'text-primary' : 'text-muted-foreground')}
              >
                {isSoundPlaying || isActive ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </Button>
              <div className="flex-1">
                <Slider
                  value={[soundVolume]}
                  onValueChange={handleVolumeChange}
                  max={1}
                  step={0.05}
                  disabled={!settings.soundEnabled || !isSoundPlaying}
                />
              </div>
              <span className="text-sm text-muted-foreground w-10 text-right">
                {Math.round(soundVolume * 100)}%
              </span>
            </div>

            {/* Sound Selection */}
            <ScrollArea className="h-40">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {AMBIENT_SOUNDS.map((sound) => (
                  <Button
                    key={sound.id}
                    variant={selectedSound === sound.id ? 'default' : 'outline'}
                    className="h-20 flex flex-col gap-1 p-2"
                    onClick={() => handleSoundSelect(sound.id)}
                  >
                    <span className="text-2xl">{sound.icon}</span>
                    <span className="text-xs font-medium">{sound.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {sound.category}
                    </Badge>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogTrigger asChild>
          <Button variant="outline" onClick={() => setShowSettings(true)} className="w-full">
            <Settings2 className="h-4 w-4 mr-2" />
            Focus Settings
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Focus Mode Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Work Duration (minutes)</Label>
              <Slider
                value={[settings.workDuration]}
                onValueChange={(v) => handleSettingsChange('workDuration', v[0])}
                min={1}
                max={60}
                step={1}
              />
              <p className="text-sm text-muted-foreground">{settings.workDuration} minutes</p>
            </div>

            <div className="space-y-2">
              <Label>Short Break Duration (minutes)</Label>
              <Slider
                value={[settings.shortBreakDuration]}
                onValueChange={(v) => handleSettingsChange('shortBreakDuration', v[0])}
                min={1}
                max={30}
                step={1}
              />
              <p className="text-sm text-muted-foreground">{settings.shortBreakDuration} minutes</p>
            </div>

            <div className="space-y-2">
              <Label>Long Break Duration (minutes)</Label>
              <Slider
                value={[settings.longBreakDuration]}
                onValueChange={(v) => handleSettingsChange('longBreakDuration', v[0])}
                min={5}
                max={60}
                step={1}
              />
              <p className="text-sm text-muted-foreground">{settings.longBreakDuration} minutes</p>
            </div>

            <div className="space-y-2">
              <Label>Long Break Interval (work sessions)</Label>
              <Slider
                value={[settings.longBreakInterval]}
                onValueChange={(v) => handleSettingsChange('longBreakInterval', v[0])}
                min={2}
                max={8}
                step={1}
              />
              <p className="text-sm text-muted-foreground">Every {settings.longBreakInterval} sessions</p>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-start Breaks</Label>
                  <p className="text-sm text-muted-foreground">Automatically start break after work session</p>
                </div>
                <Switch
                  checked={settings.autoStartBreaks}
                  onCheckedChange={(checked) => handleSettingsChange('autoStartBreaks', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-start Work</Label>
                  <p className="text-sm text-muted-foreground">Automatically start work after break</p>
                </div>
                <Switch
                  checked={settings.autoStartWork}
                  onCheckedChange={(checked) => handleSettingsChange('autoStartWork', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Notifications</Label>
                  <p className="text-sm text-muted-foreground">Show notifications when phases change</p>
                </div>
                <Switch
                  checked={settings.notificationsEnabled}
                  onCheckedChange={(checked) => handleSettingsChange('notificationsEnabled', checked)}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Session History */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {sessions.slice(-10).reverse().map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-full",
                        session.type === 'work' && 'bg-primary/10 text-primary',
                        session.type === 'short_break' && 'bg-green-500/10 text-green-500',
                        session.type === 'long_break' && 'bg-blue-500/10 text-blue-500'
                      )}>
                        {session.type === 'work' && <Brain className="h-4 w-4" />}
                        {session.type === 'short_break' && <Coffee className="h-4 w-4" />}
                        {session.type === 'long_break' && <Bed className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{session.type.replace('_', ' ')}</p>
                        <p className="text-sm text-muted-foreground">
                          {session.duration} min • {session.startTime.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={session.completed ? 'default' : 'outline'}>
                      {session.completed ? 'Done' : 'Incomplete'}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}