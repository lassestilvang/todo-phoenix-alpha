import { useEffect, useState } from "react";

/**
 * Custom hook to fetch and manage analytics data from server actions
 */
export function useAnalyticsData() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Import server action dynamically to avoid SSR issues
        const { getAnalyticsData } = await import('@/app/actions/analytics');
        const analyticsData = await getAnalyticsData();

        setData(analyticsData);
        setError(null);
      } catch (err) {
        console.error("Failed to load analytics data:", err);
        setError(err instanceof Error ? err.message : "Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up periodic refresh (every 5 minutes)
    const intervalId = setInterval(fetchData, 5 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return { data, loading, error };
}

/**
 * Hook for getting specific analytics metrics
 */
export function useAnalyticsMetrics() {
  const { data, loading, error } = useAnalyticsData();

  return {
    metrics: data?.metrics || null,
    trends: data?.trends || [],
    loading,
    error,
  };
}

/**
 * Hook for getting insights
 */
export function useAnalyticsInsights() {
  const { data } = useAnalyticsData();
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    if (data?.metrics) {
      const insightsArray: string[] = [];
      const metrics = data.metrics;

      if (metrics.taskCompletionRate > 80) {
        insightsArray.push('You have an excellent task completion rate! Keep up the great work.');
      } else if (metrics.taskCompletionRate < 50) {
        insightsArray.push('Your task completion rate is below 50%. Consider breaking large tasks into smaller ones.');
      }

      if (metrics.overdueTasks > 0) {
        insightsArray.push(`You have ${metrics.overdueTasks} overdue tasks. Try setting realistic deadlines.`);
      }

      const topHour = metrics.mostProductiveHours[0];
      if (topHour !== undefined) {
        insightsArray.push(`Your most productive hour is ${topHour}:00. Schedule important tasks during this time.`);
      }

      if (metrics.deadlineAccuracy > 75) {
        insightsArray.push('You consistently meet deadlines. Great job with time management!');
      }

      const recurringTasks = metrics.recurringTaskUsage;
      if (recurringTasks > 5) {
        insightsArray.push(`You use recurring tasks frequently (${recurringTasks} tasks). This helps build consistent habits.`);
      }

      setInsights(insightsArray);
    }
  }, [data]);

  return { insights, loading: false, error: null };
}

/**
 * Hook for getting time tracking stats
 */
export function useTimeTrackingStats() {
  const { data } = useAnalyticsData();
  return {
    stats: data?.timeTrackingStats || null,
  };
}

/**
 * Hook for getting productivity by list
 */
export function useProductivityByList() {
  const { data } = useAnalyticsData();
  return {
    listData: data?.productivityByList || [],
  };
}