"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { AnalyticsDashboard } from "@/app/components/analytics/AnalyticsDashboard";
import { TimeTrackingDashboard } from "@/components/analytics/time-tracking-dashboard";
import { GoalDashboard } from "@/components/analytics/goal-dashboard";
import { WellnessDashboard } from "@/components/analytics/wellness-dashboard";
import { TeamCollaborationDashboard } from "@/components/analytics/team-collaboration-dashboard";
import { useEffect, useState } from "react";
import { getTasks, getTimeEntries, getTasksByDateRange } from "@/app/actions/tasks";
import { format } from "date-fns";
import type { Task } from "@/lib/types/index";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, Clock, Target, Heart, Users } from "lucide-react";

interface TimeEntry {
  id: number;
  task_id: number;
  started_at: string;
  stopped_at?: string;
  duration_minutes: number;
}

// Helper function to get time entries for a period
async function getTimeEntriesForPeriod(startDate: Date, endDate: Date): Promise<TimeEntry[]> {
  try {
    // Get all time entries and filter client-side for simplicity
    const entries = await getTimeEntries(0); // Get all entries
    return entries.filter((entry: any) => {
      const entryDate = new Date(entry.started_at);
      return entryDate >= startDate && entryDate <= endDate;
    }) as TimeEntry[];
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return [];
  }
}

export default function AnalyticsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d'>('30d');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      // Get tasks for the selected timeframe
      const endDate = new Date();
      const startDateDays = parseInt(selectedTimeframe.replace('d', ''), 10);
      const startDate = new Date(endDate.getTime() - startDateDays * 24 * 60 * 60 * 1000);

      try {
        const [tasksData, timeEntriesData] = await Promise.all([
          getTasksByDateRange(
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0],
            true
          ),
          getTimeEntriesForPeriod(startDate, endDate)
        ]);

        setTasks(tasksData as Task[]);
        setTimeEntries(timeEntriesData);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedTimeframe]);

  const handleTimeframeChange = (timeframe: '7d' | '30d' | '90d') => {
    setSelectedTimeframe(timeframe);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        lists={[]}
        labels={[]}
        overdueCount={0}
        onCreateList={() => {}}
        onCreateLabel={() => {}}
      />
      <main className="flex-1 overflow-auto p-6">
        {/* Timeframe Selector */}
        <div className="mb-6 flex gap-2">
          {(['7d', '30d', '90d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedTimeframe === tf
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </button>
          ))}
        </div>

        {/* Analytics Dashboard with Tabs */}
        <Tabs defaultValue="analytics" className="space-y-4">
          <TabsList>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="time-tracking" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time Tracking
            </TabsTrigger>
            <TabsTrigger value="goals" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Goals
            </TabsTrigger>
            <TabsTrigger value="wellness" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Wellness
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <AnalyticsDashboard
              tasks={tasks}
              timeEntries={timeEntries}
              selectedTimeframe={selectedTimeframe}
              onTimeframeChange={handleTimeframeChange}
            />
          </TabsContent>
          <TabsContent value="time-tracking">
            <TimeTrackingDashboard />
          </TabsContent>
          <TabsContent value="goals">
            <GoalDashboard />
          </TabsContent>
          <TabsContent value="wellness">
            <WellnessDashboard />
          </TabsContent>
          <TabsContent value="team">
            <TeamCollaborationDashboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}