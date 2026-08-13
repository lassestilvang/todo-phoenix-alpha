export class PatternMiningService {
  taskKey(task: { created_at: number }): string {
    // Key format: h_HH_m_MM_w_WW
    const date = new Date(task.created_at)
    const weekOfMonth = Math.ceil(date.getDate() / 7)
    return `h_${date.getHours().toString().padStart(2, '0')}_m_${date.getMinutes().toString().padStart(2, '0')}_w_${weekOfMonth.toString().padStart(2, '0')}`
  }

  clusterTasks(tasks: Array<{ created_at: number }>): Map<string, Array<{ created_at: number }>> {
    const clusters = new Map()
    for (const task of tasks) {
      const key = this.taskKey(task)
      if (!clusters.has(key)) clusters.set(key, [])
      clusters.get(key)!.push(task)
    }
    return clusters
  }

  extractPatternsFromClusters(clusters: Map<string, Array<{ created_at: number }>>): Array<{ id: string; type: string; interval: number; description: string }> {
    const patterns = []
    for (const [key, tasks] of clusters) {
      const [_, hours, minutes, weeks] = key.split('_').map(s => s.replace(/[^\d]/g, ''))
      const interval = hours === minutes ? 1 : null
      const weeksNum = parseInt(weeks, 10) || 0
      const type = interval ? 'hourly' : weeksNum > 1 ? 'monthly' : 'daily'
      const getDescription = (type: string, interval: number): string => {
  let unit: string;
  if (type === 'hourly') {
    unit = 'hour';
  } else if (type === 'daily') {
    unit = 'day';
  } else if (type === 'weekly') {
    unit = 'week';
  } else if (type === 'monthly') {
    unit = 'month';
  } else {
    unit = 'time';
  }
  return `Auto-pattern: ${type} every ${interval || 1} ${unit}`;
};

patterns.push({
        id: `p_${key}`,
        type: type as 'hourly' | 'daily' | 'weekly' | 'monthly',
        interval: interval || 1,
        description: getDescription(type, interval || 1)
      });
    }
    return patterns
  }

  isConfidenceHighEnough(clusterSize: number): boolean {
    return clusterSize >= 3
  }
}
export type RecurringPatternType = (ReturnType<PatternMiningService['extractPatternsFromClusters']>)[0]['type']

// Create singleton instance
let patternMiningService: PatternMiningService | null = null;

export function getPatternMiningService(): PatternMiningService {
  if (!patternMiningService) {
    patternMiningService = new PatternMiningService();
  }
  return patternMiningService;
}

export function createPatternMiningService(): PatternMiningService {
  return new PatternMiningService();
}

// For backward compatibility
export const PatternMiningServiceClass = PatternMiningService;

// Hook for React components (returns state and actions)
export function usePatternMiningService() {
  return getPatternMiningService();
}