"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, TrendingUp, Target, Calendar, AlertTriangle, CheckCircle, Flag } from "lucide-react";
import { format, isAfter, isBefore, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner"; // Direct toast import from sonner
import { getObjectives, createObjective, updateObjectiveStatus, getGoalMetrics, getGoalRecommendations } from "@/lib/goal-tracker";
import type { Objective, GoalWithProgress, GoalMetrics } from "@/lib/goal-tracker";

interface GoalDashboardProps {
  userId?: string;
  showRecommendations?: boolean;
}

export function GoalDashboard({ userId = 'default', showRecommendations = true }: GoalDashboardProps) {
  const [objectives, setObjectives] = useState<GoalWithProgress[]>([]);
  const [metrics, setMetrics] = useState<{
    totalGoals: number;
    activeGoals: number;
    completedGoals: number;
    avgCompletionRate: number;
    goalsAtRisk: number;
    totalKeyResults: number;
    avgKeyResultProgress: number;
  } | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = getObjectives(userId);
      setObjectives(data);
      setMetrics(getGoalMetrics(userId));

      if (showRecommendations) {
        const recs = getGoalRecommendations(userId);
        setRecommendations(recs);
      }
    } catch (error) {
      console.error('Failed to load goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateObjective = async (data: {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    priority: string;
  }) => {
    try {
      createObjective({
        name: data.name,
        description: data.description,
        ownerId: userId,
        startDate: data.startDate,
        endDate: data.endDate,
        priority: data.priority as any,
      });

      toast("Objective created", {
        description: `"${data.name}" has been created`,
      });

      setShowCreateDialog(false);
      loadData();
    } catch (error) {
      console.error('Failed to create objective:', error);
      toast("Error", {
        description: "Failed to create objective",
      });
    }
  };

  const handleStatusChange = async (id: number, status: 'active' | 'completed' | 'on-hold' | 'cancelled') => {
    try {
      updateObjectiveStatus(id, status);
      toast("Objective updated", {
        description: `Status changed to ${status}`,
      });
      loadData();
    } catch (error) {
      console.error('Failed to update objective:', error);
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Goals & Objectives</h2>
          <p className="text-muted-foreground">Track your progress with OKR methodology</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Objective
        </Button>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalGoals}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.activeGoals} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {metrics.avgCompletionRate}%
              </div>
              <Progress value={metrics.avgCompletionRate} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Key Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalKeyResults}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.avgKeyResultProgress}% avg progress
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {metrics.goalsAtRisk}
              </div>
              <p className="text-xs text-muted-foreground">
                Overdue goals
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Goals List */}
      <div className="grid gap-4">
        {objectives.map((objective) => (
          <Card
            key={objective.id}
            className={cn(
              "transition-all",
              objective.status === 'completed' && "opacity-75",
              objective.isOverdue && "border-red-500"
            )}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle>{objective.name}</CardTitle>
                    <Badge variant={
                      objective.status === 'completed' ? 'default' :
                      objective.status === 'active' ? 'secondary' : 'outline'
                    }>
                      {objective.status}
                    </Badge>
                    {objective.isOverdue && (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Overdue
                      </Badge>
                    )}
                  </div>
                  {objective.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {objective.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={objective.status}
                    onValueChange={(v: any) => handleStatusChange(objective.id, v)}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on-hold">On Hold</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-medium">{objective.progressPercent}%</span>
                </div>
                <Progress value={objective.progressPercent} className="h-2" />
              </div>

              {/* Key Results */}
              {objective.keyResults && objective.keyResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Key Results</p>
                  {objective.keyResults.map((kr) => {
                    const progress = kr.targetValue > 0
                      ? Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100))
                      : 0;
                    return (
                      <div key={kr.id} className="flex items-center gap-3 p-2 border rounded">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{kr.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {kr.currentValue} / {kr.targetValue} {kr.unit}
                          </p>
                        </div>
                        <Progress value={progress} className="w-24 h-2" />
                        <span className="text-sm font-medium">{progress}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Timeline */}
              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(parseISO(objective.startDate), 'MMM d')} - {format(parseISO(objective.endDate), 'MMM d')}
                </span>
                <span className="flex items-center gap-1">
                  <Flag className="h-4 w-4" />
                  {objective.priority}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}

        {objectives.length === 0 && (
          <Card>
            <CardContent className="pt-6 pb-6">
              <div className="text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto" />
                <h3 className="mt-2 font-medium">No objectives yet</h3>
                <p className="text-sm text-muted-foreground">
                  Create your first objective to start tracking progress
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recommendations */}
      {showRecommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Task Recommendations</CardTitle>
            <CardDescription>Tasks that align with your objectives</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{rec.taskName}</p>
                    <p className="text-sm text-muted-foreground">{rec.reason}</p>
                  </div>
                  <Badge variant="outline">{rec.confidence}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <CreateObjectiveDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreate={handleCreateObjective}
      />
    </div>
  );
}

interface CreateObjectiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: any) => void;
}

function CreateObjectiveDialog({ open, onOpenChange, onCreate }: CreateObjectiveDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    priority: 'medium',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
    setFormData({
      name: '',
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      priority: 'medium',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Objective</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter objective name"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the objective"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Priority</label>
            <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Objective</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { Objective, GoalWithProgress, GoalMetrics };