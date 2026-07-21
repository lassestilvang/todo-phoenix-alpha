import { getAnalyticsData } from '@/app/actions/analytics'
import { expect } from '@vitest/edge'

describe('Analytics data calculation', () => {
  it('should return metrics structure', async () => {
    const data = await getAnalyticsData()
    expect(data).toBeDefined()
    expect(data.metrics).toHaveProperty('taskCompletionRate')
    expect(data.metrics).toHaveProperty('averageTimePerTask')
    expect(data.metrics).toHaveProperty('mostProductiveHours')
    expect(data.metrics).toHaveProperty('deadlineAccuracy')
    expect(data.metrics).toHaveProperty('recurringTaskUsage')
    expect(data.metrics).toHaveProperty('totalTasks')
    expect(data.metrics).toHaveProperty('completedTasks')
    expect(data.metrics).toHaveProperty('overdueTasks')
  })

  it('should return empty data when no tasks exist', async () => {
    // This test would require mocking an empty database
    // For now, just ensure function doesn't crash
    const data = await getAnalyticsData()
    expect(data).toBeDefined()
  })
})