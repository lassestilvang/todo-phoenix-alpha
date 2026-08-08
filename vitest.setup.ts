// Vitest setup file
import { vi } from 'vitest'

// Mock environment variables for tests
const mockDb = {
  prepare: vi.fn().mockImplementation((sql) => {
    // Mock different SQL statements based on what the tests expect
    if (sql.includes('SELECT version FROM migrations')) {
      return {
        get: vi.fn().mockReturnValue({ version: '1.0.0' }),
        all: vi.fn().mockReturnValue([]),
        run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
      };
    }
    if (sql.includes('SELECT name FROM sqlite_master WHERE type=\'table\'')) {
      return {
        all: vi.fn().mockReturnValue([
          { name: 'tasks' },
          { name: 'reminders' },
          { name: 'projects' },
          { name: 'time_tracking_rules' },
          { name: 'audit_logs' },
        ]),
        get: vi.fn(),
        run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
      };
    }
    if (sql.includes('SELECT * FROM tasks LIMIT 1')) {
      return {
        get: vi.fn().mockReturnValue({
          id: 1,
          name: 'Test Task',
          list_id: 1,
          description: 'Test task for integration',
          date: new Date().toISOString().split('T')[0],
          deadline: null,
          estimate_minutes: 30,
          actual_minutes: 0,
          priority: 'medium',
          is_completed: 0,
          is_recurring: 0,
          recurring_pattern: null,
          recurring_custom_value: null,
          dependencies: '[]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        all: vi.fn().mockReturnValue([]),
        run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
      };
    }
    // Generic mock for other queries
    return {
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([]),
      run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
    };
  }),
  exec: vi.fn(),
  pragma: vi.fn(),
};

vi.mock('@/lib/db/schema', () => {
  return {
    default: mockDb,
    ...mockDb,
  };
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock react-hook-form
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn(),
    handleSubmit: vi.fn(),
    watch: vi.fn(),
    formState: { errors: {} },
  }),
  Controller: vi.fn(),
}))

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date) => date?.toISOString?.() ?? ''),
  parseISO: vi.fn((str) => new Date(str)),
  isBefore: vi.fn(),
  isAfter: vi.fn(),
  startOfDay: vi.fn((date) => new Date(date)),
  endOfDay: vi.fn((date) => new Date(date)),
  subDays: vi.fn((date, days) => new Date(date.getTime() - days * 86400000)),
}))

console.log('Vitest setup complete')