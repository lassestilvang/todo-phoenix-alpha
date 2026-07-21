// Test utilities for mocking Next.js Server Actions
import { vi } from 'vitest'

// Mock all server actions to avoid import issues in tests
vi.mock('@/app/actions/analytics', () => ({
  getAnalyticsData: vi.fn().mockResolvedValue({
    metrics: {
      taskCompletionRate: 75,
      averageTimePerTask: 30,
      mostProductiveHours: [9, 14, 15],
      deadlineAccuracy: 80,
      recurringTaskUsage: 5,
      totalTasks: 100,
      completedTasks: 75,
      overdueTasks: 10,
    },
    trends: [],
    productivityByList: [],
    productivityByLabel: [],
    topPriorities: [],
    timeTrackingStats: {
      totalTrackedTime: 3000,
      averageSessionDuration: 60,
      longestSession: 180,
    },
  }),
}))

vi.mock('@/app/actions/tasks', () => ({
  createTaskFromNLP: vi.fn().mockResolvedValue({
    id: 1,
    name: 'Test Task',
    deadline: new Date(Date.now() + 86400000),
    priority: 'high',
    is_completed: 0,
  }),
  toggleComplete: vi.fn().mockResolvedValue({
    id: 1,
    is_completed: 1,
  }),
  getTaskSuggestions: vi.fn().mockResolvedValue({
    priority: 'high',
    estimatedMinutes: 30,
    relatedTasks: [],
  }),
  addAttachmentToTask: vi.fn().mockResolvedValue({}),
  getPendingReminders: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/db', () => ({
  taskOperations: {
    create: vi.fn().mockReturnValue({ id: 1, name: 'Test Task' }),
    getAll: vi.fn().mockReturnValue([]),
    getById: vi.fn().mockReturnValue({ id: 1, deadline: new Date(Date.now() + 86400000) }),
    getByIdWithDetails: vi.fn().mockReturnValue({ id: 1, deadline: new Date(Date.now() + 86400000) }),
    update: vi.fn(),
    delete: vi.fn(),
    toggleComplete: vi.fn(),
  },
  timeEntryOperations: {
    create: vi.fn(),
    getActiveEntry: vi.fn().mockReturnValue(null),
    stop: vi.fn(),
    getTotalTimeForTask: vi.fn().mockReturnValue(0),
    getAll: vi.fn().mockReturnValue([]),
  },
  reminderOperations: {
    create: vi.fn(),
    getPending: vi.fn().mockReturnValue([]),
  },
  listOperations: {
    getAll: vi.fn().mockReturnValue([]),
  },
  labelOperations: {
    getAll: vi.fn().mockReturnValue([]),
  },
}))

vi.mock('@/lib/analytics/dashboard', () => ({
  AnalyticsDashboard: vi.fn().mockImplementation(() => ({
    getDashboardData: () => ({}),
  })),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Next.js cache functions
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))