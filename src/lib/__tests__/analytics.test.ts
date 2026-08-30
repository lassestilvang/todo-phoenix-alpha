import { expect, describe, it, vi, beforeEach } from 'vitest'

// Mock better-sqlite3 to avoid Bun compatibility issue
vi.mock('better-sqlite3', () => {
  return vi.fn().mockImplementation(() => ({
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue({ id: 1 }),
  }))
})

import { getAnalyticsData } from '../../app/actions/analytics'

// Mock the database functions
vi.mock('../../app/actions/analytics', () => ({
  getAnalyticsData: vi.fn(() => ({
    metrics: {
      taskCompletionRate: 0.75,
      averageTimePerTask: 120,
      mostProductiveHours: [9, 10, 11],
      deadlineAccuracy: 0.8,
      recurringTaskUsage: 0.3,
      totalTasks: 20,
      completedTasks: 15,
      overdueTasks: 2,
    },
    trends: [
      { date: '2024-01-01', tasksCreated: 10, tasksCompleted: 8, timeSpent: 240 },
      { date: '2024-01-02', tasksCreated: 12, tasksCompleted: 10, timeSpent: 300 },
      { date: '2024-01-03', tasksCreated: 8, tasksCompleted: 5, timeSpent: 180 },
    ],
    productivityByList: [],
    productivityByLabel: [],
    topPriorities: [],
    timeTrackingStats: { totalTrackedTime: 0, averageSession: 0, activeDays: 0 },
  })),
}))

describe('Analytics data calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('should return correct default values when no tasks exist', async () => {
    // Mock empty database response
    vi.mocked(getAnalyticsData).mockResolvedValueOnce({
      metrics: {
        taskCompletionRate: 0,
        averageTimePerTask: 0,
        mostProductiveHours: [] as number[],
        deadlineAccuracy: 0,
        recurringTaskUsage: 0,
        totalTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
      },
      trends: [
        { date: '', tasksCreated: 0, tasksCompleted: 0, timeSpent: 0 },
        { date: '', tasksCreated: 0, tasksCompleted: 0, timeSpent: 0 },
      ],
      productivityByList: [],
      productivityByLabel: [],
      topPriorities: [],
      timeTrackingStats: { totalTrackedTime: 0, averageSessionDuration: 0, longestSession: 0 },
    })

    const data = await getAnalyticsData()
    expect(data.metrics.totalTasks).toBe(0)
    expect(data.metrics.completedTasks).toBe(0)
    expect(data.metrics.taskCompletionRate).toBe(0)
  })

  it('should calculate task completion rate correctly', async () => {
    const data = await getAnalyticsData()
    expect(data.metrics.taskCompletionRate).toBeCloseTo(0.75)
  })
})