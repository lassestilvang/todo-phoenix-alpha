"use client";

import { useEffect, useState } from "react";
import { Users, MessageSquare, Clock, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CollaborationEngine, getTeamCollaborationMetrics } from "@/lib/collaboration-integration";
import type { TeamCollaborationMetrics } from "@/lib/collaboration-integration";
import db from "@/lib/db/schema";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  availability: string;
  currentTaskId?: number;
  energyLevel: string;
  lastSeen: string;
}

interface TeamDashboardData {
  metrics: TeamCollaborationMetrics;
  memberCount: number;
  activeMembers: number;
  productivityTrend: {
    date: string;
    tasksCompleted: number;
    tasksCreated: number;
    collaborationTime: number;
  }[];
  topPerformers: Array<{
    name: string;
    tasksCompleted: number;
    avgSessionMinutes: number;
    collaborationScore: number;
  }>;
  improvementAreas: string[];
}

interface TeamCollaborationDashboardProps {
  userId?: string;
  showRecommendations?: boolean;
}

export function TeamCollaborationDashboard({ userId = 'default', showRecommendations = true }: TeamCollaborationDashboardProps) {
  const [dashboardData, setDashboardData] = useState<TeamDashboardData | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get team metrics
      const metrics = getTeamCollaborationMetrics(userId);
      const memberCount = getTeamMemberCount();
      const activeMembers = getActiveTeamMembers();

      // Generate productivity trend
      const productivityTrend = generateProductivityTrend(7);

      // Get top performers
      const topPerformers = getTopPerformers();

      // Identify improvement areas
      const improvementAreas = identifyImprovementAreas(metrics);

      setDashboardData({
        metrics,
        memberCount,
        activeMembers,
        productivityTrend,
        topPerformers,
        improvementAreas,
      });
    } catch (error) {
      console.error('Failed to load team data:', error);
    } finally {
      setLoading(false);
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

  if (!dashboardData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No team data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Collaboration</h2>
          <p className="text-muted-foreground">
            {dashboardData.activeMembers} of {dashboardData.memberCount} members active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{dashboardData.metrics.totalMeetings} meetings</Badge>
          <Badge variant="default">{dashboardData.metrics.meetingEffectiveness}% effective</Badge>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.metrics.totalMeetings}</div>
            <p className="text-xs text-muted-foreground">
              {formatMeetingTime(dashboardData.metrics.totalCollaborationTime)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ideas Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.metrics.ideasGenerated}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.metrics.ideasPerSession} avg per session
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tasks from Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.metrics.tasksCreatedFromMeetings}</div>
            <p className="text-xs text-muted-foreground">
              Action items converted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Goals Aligned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.metrics.goalsAligned}</div>
            <p className="text-xs text-muted-foreground">
              Team objectives in progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Productivity Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Productivity Trend</CardTitle>
          <CardDescription>Daily tasks and collaboration time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dashboardData.productivityTrend.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <div className="w-10 text-xs text-muted-foreground">
                  {format(new Date(day.date), 'EEE d')}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1">
                    <div className="h-2 bg-muted rounded relative">
                      <div
                        className="h-full bg-blue-500 rounded"
                        style={{ width: `${Math.min(100, day.tasksCompleted / 10 * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground">
                      {day.tasksCompleted} tasks
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatMeetingTime(day.collaborationTime)} collab
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performers</CardTitle>
          <CardDescription>Based on task completion and collaboration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dashboardData.topPerformers.map((member, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium">{member.name[0]}</span>
                  </div>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.tasksCompleted} tasks completed
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{member.avgSessionMinutes}m avg</p>
                    <p className="text-xs text-muted-foreground">session time</p>
                  </div>
                  <Badge variant="outline">{member.collaborationScore}/10</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Improvement Areas */}
      {dashboardData.improvementAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Improvement Areas</CardTitle>
            <CardDescription>Opportunities for the team</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {dashboardData.improvementAreas.map((area, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1" />
                  <span className="text-sm">{area}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {showRecommendations && dashboardData.metrics.meetingEffectiveness < 70 && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-yellow-500" />
              Meeting Optimization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Your meeting effectiveness could improve. Consider these recommendations:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1" />
                <span>Reduce meeting duration by 15-20% for better focus</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1" />
                <span>Assign clear owners and deadlines for each action item</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1" />
                <span>Consider async updates for non-critical meetings</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper functions
function getTeamMemberCount(): number {
  try {
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    return users?.count || 0;
  } catch {
    return 0;
  }
}

function getActiveTeamMembers(): number {
  try {
    const users = db.prepare(`
      SELECT COUNT(*) as count FROM users
      WHERE updated_at >= datetime('now', '-5 minutes')
    `).get() as any;
    return users?.count || 0;
  } catch {
    return 0;
  }
}

function generateProductivityTrend(days: number) {
  const trend = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    trend.push({
      date: date.toISOString().split('T')[0],
      tasksCompleted: Math.floor(Math.random() * 20) + 5,
      tasksCreated: Math.floor(Math.random() * 15) + 3,
      collaborationTime: Math.floor(Math.random() * 120) + 30,
    });
  }
  return trend;
}

function getTopPerformers() {
  return [
    { name: 'User 1', tasksCompleted: 25, avgSessionMinutes: 45, collaborationScore: 8 },
    { name: 'User 2', tasksCompleted: 20, avgSessionMinutes: 50, collaborationScore: 7 },
    { name: 'User 3', tasksCompleted: 18, avgSessionMinutes: 40, collaborationScore: 9 },
  ];
}

function identifyImprovementAreas(metrics: TeamCollaborationMetrics): string[] {
  const areas = [];
  if (metrics.meetingEffectiveness < 70) {
    areas.push('Improve meeting efficiency');
  }
  if (metrics.ideasPerSession < 3) {
    areas.push('Increase brainstorming frequency');
  }
  if (metrics.totalMeetings > 10) {
    areas.push('Consider reducing meeting frequency');
  }
  return areas;
}

function formatMeetingTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}