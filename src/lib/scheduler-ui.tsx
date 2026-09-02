// Scheduler UI component for displaying adaptive task recommendations
"use client";

import { useEffect, useState } from "react";
import { useTimeTracker } from "@/lib/hooks/use-time-tracker";
import { getSchedulingInsights, getDailyRecommendations } from "@/lib/adaptive-scheduler";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, Target, TrendingUp, Activity, BarChart } from "lucide-react";

export interface SchedulerInsightsProps {
  taskId: number;
  showRecommendations?: boolean;
  onScheduleTask?: (recommendation: any) => void;
}

export function SchedulerInsights({ taskId, showRecommendations = true, onScheduleTask }: SchedulerInsightsProps) {
  const [insights, setInsights] = useState<{
    bestTimeSlots: any[];
    estimatedCompletionRate: number;
    suggestedDuration: number;
    procrastinationRisk: string;
  } | null>(null);
  const [dailyRecommendations, setDailyRecommendations] = useState<SchedulingRecommendation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { isRunning, elapsedSeconds, formatTime } = useTimeTracker(taskId);
  const { open: toastOpen, dismiss: dismissToast } = useToast();

  useEffect(() => {
    const loadInsights = async () => {
      setLoading(true);
      try {
        // Get scheduling insights
        const schedulingInsights = await getSchedulingInsights(taskId);
        setInsights(schedulingInsights);

        // Get daily recommendations if user wants to see them
        if (showRecommendations) {
          const date = new Date();
          const recommendations = getDailyRecommendations(date, 5);
          setDailyRecommendations(recommendations);
        }
      } catch (error) {
        console.error('Failed to load scheduling insights:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, [taskId, showRecommendations]);

  useEffect(() => {
    // Learn from completion when timer stops
    return () => {
      if (!isRunning) {
        const task = taskId ? null : null; // Would need task reference
        // learnFromCompletion(taskId, false, elapsedSeconds); // Would need actual data
      }
    };
  }, [isRunning]);

  if (loading) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground">Loading scheduling insights...</p>
      </Card>
    );
  }

  if (!insights) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground">No scheduling insights available yet</p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Complete tasks to generate adaptive scheduling recommendations
        </p>
      </Card>
    );
  }

  const riskColors = {
    low: "bg-green-500/10 text-green-500",
    medium: "bg-yellow-500/10 text-yellow-500",
    high: "bg-red-500/10 text-red-500",
  };

  return (
    <Card className="p-4 space-y-4">
      {/* Completion Risk */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={riskColors[insights.procrastinationRisk]}>
          {insights.procrastinationRisk.charAt(0).toUpperCase() + insights.procrastinationRisk.slice(1)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Completion risk: {insights.procrastinationRisk}
        </span>
      </div>

      {/* Estimated completion rate */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Est. completion rate: </span>
        <span className="font-medium">
          {Math.round(insights.estimatedCompletionRate * 100)}%
        </span>
      </div>

      {/* Suggested duration */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Suggested duration: </span>
        <span className="font-medium font-mono">
          {formatTime(insights.suggestedDuration)} ({insights.suggestedDuration} min)
        </span>
      </div>

      {/* Time slots section */}
      {!showRecommendations || insights.bestTimeSlots.length > 0 ? (
        <div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Best time slots{' '}
              {insights.bestTimeSlots.map((slot, idx) => (
                <span key={idx} className="text-xs text-muted-foreground ms-1">
                  {slot.dayOfWeek}:{slot.hour < 10 ? '0' : ''}{slot.hour}:00
                </span>
              ))}
            </CardTitle>
          </CardHeader>

          <div className="mt-2 space-y-1">
            {insights.bestTimeSlots.slice(0, 3).map((slot) => (
              <div
                key={slot.hour}
                className={cn(
                  "p-2 rounded border",
                  slot.confidence > 0.7 ? "bg-green-50" : slot.confidence > 0.5 ? "bg-yellow-50" : "bg-red-50"
                )}
              >
                <div className="flex justify-between text-xs">
                  <span>{slot.dayOfWeek}:{slot.hour < 10 ? '0' : ''}{slot.hour}:00</span>
                  <span className="text-primary">{Math.round(slot.confidence * 100)}% match</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <p>Click "Get Recommendations" to see optimal times</p>
        </div>
      )}

      {/* Daily recommendations */}
      {dailyRecommendations && dailyRecommendations.length > 0 && (
        <div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Today's schedule
            </CardTitle>
          </CardHeader>

          <div className="mt-2 space-y-1">
            {dailyRecommendations.map((rec) => (
              <div
                key={rec.taskId}
                className={cn(
                  "p-2 rounded border bg-muted/50 flex items-center justify-between",
                  rec.confidence > 0.7 ? "bg-green-50" : "bg-yellow-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium truncate flex-1">
                    {rec.taskName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {rec.scheduledTime}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium">
                    {rec.priority}/10
                  </span>
                  <span className="text-xs text-muted-foreground">{rec.confidence > 0 ? Math.round(rec.confidence * 100) + '%' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => dismissToast()}
          className="hidden sm:block"
        >
          Dismiss
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            // Show today's recommendations
            if (dailyRecommendations) {
              const todayRecs = dailyRecommendations.filter(
                (r) => r.scheduledDate === new Date().toISOString().split('T')[0]
              );
              if (onScheduleTask && todayRecs.length > 0) {
                onScheduleTask(todayRecs[0]);
              }
            }
          }}
        >
          Schedule Today
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {}}
        >
          More Options
        </Button>
      </div>
    </Card>
  );
}

// Export type for use with task detail modal
export type { SchedulingRecommendation, TaskPattern, UserBehaviorProfile, AdaptiveScheduleConfig };