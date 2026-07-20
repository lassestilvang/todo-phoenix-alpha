"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { AnalyticsDashboardView } from "@/components/analytics/dashboard-charts";
import { useEffect, useState } from "react";
import { getLists, getLabels, getTasks } from "@/app/actions/tasks";
import type { List, Label } from "@/lib/types";

export default function AnalyticsPage() {
  const [lists, setLists] = useState<List[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const [listsData, labelsData] = await Promise.all([
        getLists(),
        getLabels()
      ]);
      setLists(listsData);
      setLabels(labelsData);

      // Count overdue tasks
      const allTasks = await getTasks(false);
      const overdue = allTasks.filter(task => {
        if (!task.deadline || task.is_completed > 0) return false;
        return new Date(task.deadline) < new Date();
      });
      setOverdueCount(overdue.length);
    };

    fetchData();
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        lists={lists}
        labels={labels}
        overdueCount={overdueCount}
        onCreateList={() => {}}
        onCreateLabel={() => {}}
      />
      <main className="flex-1 overflow-auto">
        <AnalyticsDashboardView />
      </main>
    </div>
  );
}