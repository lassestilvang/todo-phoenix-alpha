export class PatternMiningService {
  taskKey(task: { created_at: number }): string {
    // Key format: h_HH_m_MM_w_WW (uses UTC for deterministic behavior)
    const date = new Date(task.created_at)
    const weekOfMonth = Math.ceil(date.getUTCDate() / 7)
    return `h_${date.getUTCHours()}_m_${date.getUTCMinutes()}_w_${weekOfMonth}`
  }

  clusterTasks(tasks: Array<{ created_at: number }>): Map<string, Array<{ created_at: number }>> {
    const clusters = new Map<string, Array<{ created_at: number }>>()
    for (const task of tasks) {
      const key = this.taskKey(task)
      if (!clusters.has(key)) clusters.set(key, [])
      clusters.get(key)!.push(task)
    }
    return clusters
  }

  extractPatternsFromClusters(
    clusters: Map<string, Array<{ created_at: number }>>
  ): Array<{ id: string; type: 'hourly' | 'daily' | 'weekly' | 'monthly'; interval: number; description: string }> {
    const patterns: Array<{ id: string; type: 'hourly' | 'daily' | 'weekly' | 'monthly'; interval: number; description: string }> = []
    for (const [key, tasks] of clusters) {
      const parts = key.split('_')
      // parts: ['h', '<hour>', 'm', '<minute>', 'w', '<week>']
      const weekNum = parseInt(parts[parts.length - 1], 10) || 0

      // Determine recurrence type from the week-of-month anchor:
      //   week 1  → daily   (tasks clustered in the first week of the month)
      //   week 2+ → monthly (tasks anchored to a specific week of the month)
      //   no week → weekly  (fallback)
      let type: 'daily' | 'weekly' | 'monthly'
      if (weekNum > 1) {
        type = 'monthly'
      } else if (weekNum === 1) {
        type = 'daily'
      } else {
        type = 'weekly'
      }

      const interval = 1
      const unit = type === 'daily' ? 'day' : type === 'weekly' ? 'week' : 'month'

      patterns.push({
        id: `p_${key}`,
        type,
        interval,
        description: `Auto-pattern: ${type} every ${interval} ${unit}`,
      })
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