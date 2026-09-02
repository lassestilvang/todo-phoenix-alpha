"use client";

import { useEffect, useState } from "react";
import { Heart, Coffee, Footprints, Dumbbell, Brain, Calendar, TrendingUp, TrendingDown, Pause } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getWellnessMetrics,
  getRecoverySuggestions,
  generateDailyGoals,
  getWellnessRecommendations,
  checkBurnoutRisk,
  getWellnessDashboardData,
} from "@/lib/wellness-monitor";
import type { WellnessMetrics, RecoverySuggestion, DailyGoal } from "@/lib/wellness-monitor";

interface WellnessDashboardProps {
  userId?: string;
  showRecoverySuggestions?: boolean;
}

export function WellnessDashboard({ userId = 'default', showRecoverySuggestions = true }: WellnessDashboardProps) {
  const [metrics, setMetrics] = useState<WellnessMetrics | null>(null);
  const [recoverySuggestions, setRecoverySuggestions] = useState<RecoverySuggestion[]>([]);
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([]);
  const [burnoutCheck, setBurnoutCheck] = useState<{ isAtRisk: boolean; riskLevel: string; interventions: string[] }>({
    isAtRisk: false,
    riskLevel: 'low',
    interventions: [],
  });
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<RecoverySuggestion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      setMetrics(getWellnessMetrics(userId));
      setRecoverySuggestions(getRecoverySuggestions(userId));
      setDailyGoals(generateDailyGoals(userId));
      setBurnoutCheck(checkBurnoutRisk(userId));
      setDashboardData(getWellnessDashboardData(userId));
    } catch (error) {
      console.error('Failed to load wellness data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return "bg-green-500/10 text-green-500";
      case 'medium': return "bg-yellow-500/10 text-yellow-500";
      case 'high': return "bg-red-500/10 text-red-500";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  const getStressColor = (score: number) => {
    if (score < 30) return "text-green-500";
    if (score < 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getWellbeingColor = (score: number) => {
    if (score > 70) return "text-green-500";
    if (score > 40) return "text-yellow-500";
    return "text-red-500";
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No wellness data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Wellness Dashboard</h2>
          <p className="text-muted-foreground">Monitor your productivity and wellbeing</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getRiskColor(burnoutCheck.riskLevel)}>
            {burnoutCheck.riskLevel}
          </Badge>
          {burnoutCheck.isAtRisk && (
            <Button variant="destructive" size="sm">
              View Interventions
            </Button>
          )}
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Work Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStressColor(metrics.stressScore)}`}>
              {Math.round(metrics.totalWorkMinutesToday / 60)}h {metrics.totalWorkMinutesToday % 60}m
            </div>
            <Progress value={Math.min(100, metrics.totalWorkMinutesToday / 480 * 100)} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.burnoutRisk === 'high' ? '⚠️ Over daily limit' : 'On track'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Stress Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStressColor(metrics.stressScore)}`}>
              {Math.round(metrics.stressScore)}/100
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.burnoutRisk} risk
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Wellbeing Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getWellbeingColor(metrics.wellbeingScore)}`}>
              {Math.round(metrics.wellbeingScore)}/100
            </div>
            <Progress value={metrics.wellbeingScore} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Energy Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.energyLevel === 'high' ? '🔥 High' : metrics.energyLevel === 'medium' ? '⚡ Medium' : '🧊 Low'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.energyLevel === 'high' ? 'Peak productivity hours' : 'Consider lighter tasks'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakout: Weekly Trends */}
      {dashboardData && (
        <Card>
          <CardHeader>
            <CardTitle>Weekly Trend</CardTitle>
            <CardDescription>Last 7 days of wellbeing metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.weeklyTrend.map((day: any) => (
                <div key={day.date} className="flex items-center gap-3">
                  <div className="w-10 text-xs text-muted-foreground">
                    {format(new Date(day.date), 'EEE d')}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1">
                      <div className="h-2 bg-muted rounded relative">
                        <div
                          className="h-full bg-blue-500 rounded"
                          style={{ width: `${Math.min(100, day.productivity)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className={`text-xs ${getStressColor(day.stressScore)}`}>
                        S:{Math.round(day.stressScore)}
                      </span>
                      <span className={`text-xs ${getWellbeingColor(day.wellbeing)}`}>
                        W:{Math.round(day.wellbeing)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Goals */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Goals</CardTitle>
          <CardDescription>Track your wellbeing goals for today</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dailyGoals.map((goal) => {
              const icon = goal.type === 'work' ? <Coffee className="h-4 w-4" /> :
                goal.type === 'break' ? <Pause className="h-4 w-4" /> :
                goal.type === 'exercise' ? <Dumbbell className="h-4 w-4" /> :
                goal.type === 'social' ? <Heart className="h-4 w-4" /> :
                <Brain className="h-4 w-4" />;

              const progress = (goal.actualMinutes / goal.targetMinutes) * 100;

              return (
                <div key={goal.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                    {icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <p className="font-medium">{goal.type} goal</p>
                      <span className="text-sm text-muted-foreground">
                        {goal.actualMinutes}/{goal.targetMinutes} min
                      </span>
                    </div>
                    <Progress value={progress} className="h-1.5 mt-1" />
                  </div>
                  {goal.completed && (
                    <Badge variant="default" className="text-xs">
                      Done
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recovery Suggestions */}
      {showRecoverySuggestions && recoverySuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recovery Suggestions</CardTitle>
            <CardDescription>AI-generated recommendations for your wellbeing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recoverySuggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all",
                    "hover:bg-muted/50",
                    suggestion.urgency === 'high' && "border-red-500 bg-red-50",
                    suggestion.urgency === 'medium' && "border-yellow-500 bg-yellow-50",
                    suggestion.urgency === 'low' && "border-blue-500 bg-blue-50",
                  )}
                  onClick={() => setSelectedSuggestion(suggestion)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {suggestion.type === 'break' && <Coffee className="h-4 w-4 text-orange-500" />}
                      {suggestion.type === 'walk' && <Footprints className="h-4 w-4 text-green-500" />}
                      {suggestion.type === 'exercise' && <Dumbbell className="h-4 w-4 text-blue-500" />}
                      {suggestion.type === 'meditation' && <Brain className="h-4 w-4 text-purple-500" />}
                      {suggestion.type === 'social' && <Heart className="h-4 w-4 text-pink-500" />}
                      <span className="font-medium capitalize">{suggestion.type}</span>
                    </div>
                    <Badge
                      variant={suggestion.urgency === 'high' ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {suggestion.urgency}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {suggestion.description}
                  </p>
                  <div className="flex justify-between text-xs mt-2">
                    <span>{suggestion.durationMinutes} min</span>
                    <span>{Math.round(suggestion.confidence * 100)}% confidence</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recovery Suggestions Detail */}
      <Dialog open={!!selectedSuggestion} onOpenChange={() => setSelectedSuggestion(null)}>
        <DialogContent>
          {selectedSuggestion && (
            <div>
              <DialogHeader>
                <DialogTitle>{selectedSuggestion.type} suggestion</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p>{selectedSuggestion.description}</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Duration: {selectedSuggestion.durationMinutes} minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Confidence: {Math.round(selectedSuggestion.confidence * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={selectedSuggestion.urgency === 'high' ? 'destructive' : 'secondary'}>
                    {selectedSuggestion.urgency} urgency
                  </Badge>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setSelectedSuggestion(null)}>
                    Dismiss
                  </Button>
                  <Button>Start Session</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Burnout Interventions */}
      {burnoutCheck.isAtRisk && (
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Burnout Prevention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              You're showing signs of potential burnout. Here are recommended interventions:
            </p>
            <ul className="space-y-2">
              {burnoutCheck.interventions.map((intervention, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1" />
                  <span>{intervention}</span>
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" className="mt-4">
              Schedule Recovery Time
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export type { WellnessMetrics, RecoverySuggestion, DailyGoal };