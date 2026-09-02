"use client";

import { useEffect, useState } from "react";
import {
  Calendar, Clock, TrendingUp, BarChart3, PieChart,
  Download, RefreshCw, Settings, Play, Pause,
  CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useTimeTracker } from "@/lib/hooks/use-time-tracker";
import db from "@/lib/db/schema";
import { toast } from "sonner";

interface TimeEntry {
  id: number;
  taskId: number;
  taskName: string;
  startedAt: string;
  stoppedAt: string | null;
  durationMinutes: number;
  isRunning: boolean;
}

interface TimeTrackingDashboardProps {
  className?: string;
}

interface DailyStats {
  date: string;
  totalMinutes: number;
  tasksCompleted: number;
  tasksInProgress: number;
  productiveMinutes: number;
}

interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  avgDailyMinutes: number;
  completionRate: number;
  productivityScore: number;
}

interface EnergyLevel {
  hour: number;
  level: number; // 0-1
  productivity: number; // 0-1
}

export function TimeTrackingDashboard({ className }: TimeTrackingDashboardProps) {
  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month'>('week');
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [energyLevels, setEnergyLevels] = useState<EnergyLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    setIsLoading(true);

    try {
      const now = new Date();
      const entries = db.prepare(`
        SELECT t.id as id, t.task_id as taskId, t.name as taskName, t.started_at as startedAt, t.stopped_at as stoppedAt, t.duration_minutes as durationMinutes
        FROM time_entries t
        WHERE t.started_at >= ?
        ORDER BY t.started_at DESC
      `).all(
        dateRange === 'day'
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString()
          : dateRange === 'week'
            ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 27).toISOString()
            : new Date(now.getFullYear(), now.getMonth(), 0).toISOString()
      ) as any[];

      setTimeEntries(entries);

      // Calculate daily stats for last 7 days
      const stats: DailyStats[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const dayEntries = entries.filter(e =>
          e.started_at.startsWith(dateStr) ||
          (e.stopped_at && e.stopped_at.startsWith(dateStr))
        );

        const taskEntries = db.prepare(`
          SELECT t.id as id, t.name, te.started_at as startedAt, te.stopped_at as stoppedAt, te.duration_minutes as durationMinutes
          FROM time_entries te
          JOIN tasks t ON te.task_id = t.id
          WHERE te.started_at >= ? AND te.started_at < ?
          AND t.deadline IS NOT NULL AND t.deadline >= te.started_at
        `).all(
          new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString(),
          new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString()
        ) as any[];

        stats.push({
          date: dateStr,
          totalMinutes: dayEntries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0),
          tasksCompleted: taskEntries.filter(e => e.stoppedAt !== null && !db.prepare('SELECT * FROM tasks WHERE id = ?').get(e.id)?.is_completed).length,
          tasksInProgress: dayEntries.filter(e => e.stoppedAt === null).length,
          productiveMinutes: dayEntries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0),
        });
      }
      setDailyStats(stats);

      // Calculate weekly stats
      const weekStart = startOfWeek(now);
      const weekEnd = endOfWeek(now);
      const totalMinutes = stats.reduce((sum, s) => sum + s.totalMinutes, 0);
      const weekStats: WeeklyStats[] = [];

      for (let w = 0; w < 4; w++) {
        const weekStart = startOfWeek(new Date(now.getTime() - (3 - w) * 7 * 24 * 60 * 60 * 1000));
        const weekEnd = endOfWeek(weekStart);
        const weekEntries = entries.filter(e => {
          const entryDate = new Date(e.started_at);
          return entryDate >= weekStart && entryDate <= weekEnd;
        });

        weekStats.push({
          weekStart: weekStart.toISOString().split('T')[0],
          weekEnd: weekEnd.toISOString().split('T')[0],
          totalMinutes: weekEntries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0),
          avgDailyMinutes: weekEntries.length > 0
            ? weekEntries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0) / 7
            : 0,
          completionRate: weekEntries.filter(e => e.durationMinutes).length / Math.max(1, weekEntries.length),
          productivityScore: Math.min(1, totalMinutes / 2880), // 8 hours/day * 6 days max
        });
      }
      setWeeklyStats(weekStats);

      // Calculate energy levels (based on when tasks were typically done)
      const hourCounts: number[] = Array(24).fill(0);
      const hourDurations: number[] = Array(24).fill(0);

      entries.forEach(e => {
        const hour = new Date(e.startedAt).getHours();
        hourCounts[hour]++;
        hourDurations[hour] += e.durationMinutes || 0;
      });

      const maxDuration = Math.max(...hourDurations) || 1;
      const energyData = hourCounts.map((count, hour) => ({
        hour,
        level: count > 0 ? 1 : 0,
        productivity: maxDuration > 0 ? hourDurations[hour] / maxDuration : 0,
      }));

      setEnergyLevels(energyData);
    } catch (error) {
      console.error('Error loading time tracking data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeDisplay = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDateRange = (start: string, end: string) => {
    return `${format(new Date(start), 'MMM d')} - ${format(new Date(end), 'MMM d')}`;
  };

  const getTotalDuration = (): number => {
    return timeEntries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
  };

  const getActiveTasks = () => {
    return timeEntries.filter(e => !e.stoppedAt);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading time tracking data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalDuration = getTotalDuration();
  const activeTasks = getActiveTasks();
  const avgSession = dailyStats.length > 0
    ? Math.round(totalDuration / dailyStats.reduce((sum, d) => sum + d.totalMinutes, 0))
    : 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Time Tracking Dashboard</h2>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Last 7 Days</SelectItem>
              <SelectItem value="week">Last 4 Weeks</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTimeDisplay(totalDuration)}</div>
            <p className="text-xs text-muted-foreground">
              {timeEntries.length} sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{activeTasks.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeTasks.reduce((sum, t) => sum + (t.durationMinutes || 0), 0)}m total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Session</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgSession}m</div>
            <p className="text-xs text-muted-foreground">
              Duration per session
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Productivity Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Math.round(Math.max(...weeklyStats.map(w => w.productivityScore)) * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Best week performance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Activity</CardTitle>
          <CardDescription>Last 7 days of time tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dailyStats.map((day) => (
              <div key={day.date} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{format(new Date(day.date), 'EEE, MMM d')}</span>
                  <span className="font-medium">{formatTimeDisplay(day.totalMinutes)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={(day.totalMinutes / 480) * 100} className="flex-1 h-2" />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{day.tasksInProgress} in progress</span>
                  <span>{day.tasksCompleted} completed</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Energy Pattern Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Energy Pattern</CardTitle>
          <CardDescription>When you're most productive</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-24 gap-1">
            {energyLevels.map((level, hour) => (
              <div key={hour} className="text-center">
                <div className="text-xs text-muted-foreground mb-1">
                  {hour < 10 ? '0' + hour : hour}
                </div>
                <div
                  className={cn(
                    "rounded transition-colors",
                    level.productivity > 0.5 ? "bg-green-500" :
                    level.productivity > 0.3 ? "bg-yellow-500" :
                    "bg-gray-200 dark:bg-gray-700"
                  )}
                  style={{
                    height: level.productivity * 40,
                    opacity: level.productivity > 0 ? 0.8 : 0.3,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Higher bars = more productive hours
          </div>
        </CardContent>
      </Card>

      {/* Weekly Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Trends</CardTitle>
          <CardDescription>Last 4 weeks of productivity</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Week</th>
                <th className="text-right py-2">Hours</th>
                <th className="text-right py-2">Completion</th>
                <th className="text-right py-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {weeklyStats.map((week, idx) => (
                <tr key={idx} className="border-b">
                  <td className="py-2 text-muted-foreground">
                    {format(new Date(week.weekStart), 'MMM d')} - {format(new Date(week.weekEnd), 'MMM d')}
                  </td>
                  <td className="text-right py-2 font-medium">
                    {formatTimeDisplay(week.totalMinutes)}
                  </td>
                  <td className="text-right py-2">
                    <Badge variant={week.completionRate > 0.7 ? "default" : "outline"}>
                      {Math.round(week.completionRate * 100)}%
                    </Badge>
                  </td>
                  <td className="text-right py-2">
                    <Progress value={week.productivityScore * 100} className="w-16 h-2 inline-block" />
                    <span className="ml-2">{Math.round(week.productivityScore * 100)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      {activeTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Currently running timers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeTasks.map((entry) => {
                const duration = entry.durationMinutes || 0;
                const hours = Math.floor(duration / 60);
                const mins = duration % 60;
                return (
                  <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{entry.taskName}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.startedAt ? `Started ${format(new Date(entry.startedAt), 'HH:mm')}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg">
                        {hours.toString().padStart(2, '0')}:{mins.toString().padStart(2, '0')}
                      </p>
                      <Button size="sm" variant="ghost">
                        <Pause className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Export helper for Pomodoro integration
export function calculateOptimalSessionLength(
  userHistory: { completed: boolean; actualDuration: number; productivity: number }[],
  currentSessionCount: number = 0
): { workDuration: number; breakDuration: number; confidence: number } {
  if (userHistory.length === 0) {
    return { workDuration: 25, breakDuration: 5, confidence: 0.5 };
  }

  const avgDuration = userHistory.reduce((sum, h) => sum + h.actualDuration, 0) / userHistory.length;
  const completionRate = userHistory.filter(h => h.completed).length / userHistory.length;
  const avgProductivity = userHistory.reduce((sum, h) => sum + h.productivity, 0) / userHistory.length;

  // Adjust based on completion rate and productivity
  let workDuration = Math.round(avgDuration);
  let breakDuration = Math.round(workDuration * 0.2);

  // Standard Pomodoro if no history
  if (workDuration < 15 || workDuration > 120) {
    workDuration = 25;
    breakDuration = 5;
  }

  // Every 4th session is a long break
  if (currentSessionCount % 4 === 0) {
    breakDuration = workDuration * 0.3;
  }

  const confidence = Math.min(0.95, 0.5 + (completionRate * 0.3) + (avgProductivity * 0.3));

  return { workDuration, breakDuration, confidence };
}

export type { TimeEntry, DailyStats, WeeklyStats, EnergyLevel };