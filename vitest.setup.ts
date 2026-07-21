// Vitest setup file
import { vi } from 'vitest'

// Mock environment variables for tests
vi.mock('@/lib/db/schema', () => ({
  default: {
    prepare: vi.fn().mockReturnValue({
      run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
      get: vi.fn(),
      all: vi.fn().mockReturnValue([]),
    }),
    exec: vi.fn(),
    pragma: vi.fn(),
  },
}))

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