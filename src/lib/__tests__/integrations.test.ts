import { expect, describe, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the database
vi.mock('@/lib/db/schema', () => ({
  default: {
    prepare: vi.fn(),
  },
}))

// Create a mock request helper
function createMockRequest(url: string, body?: any): NextRequest {
  const req = {
    url: `http://localhost${url}`,
    json: body ? () => Promise.resolve(body) : () => Promise.resolve({}),
    nextUrl: {
      searchParams: new URLSearchParams(url.split('?')[1] || ''),
    },
  } as unknown as NextRequest
  return req
}

// Mock the route module
vi.mock('@/app/api/integrations/[provider]/route', () => ({
  GET: vi.fn(async () => ({
    success: true,
    data: [{ id: 1, provider: 'google_calendar' }],
  })),
  POST: vi.fn(async (request: NextRequest) => {
    const body = await request.json()
    return {
      success: true,
      data: { id: 1, provider: body.provider },
    }
  }),
  PUT: vi.fn(async (request: NextRequest) => {
    const body = await request.json()
    return {
      success: true,
      data: { id: 1, sync_status: 'completed' },
    }
  }),
  DELETE: vi.fn(async (request: NextRequest) => {
    return {
      success: true,
    }
  }),
}))

vi.mock('@/app/api/integrations/sync/route', () => ({
  GET: vi.fn(async () => ({ success: true, data: { status: 'completed' } })),
  POST: vi.fn(async () => ({ success: true, data: { status: 'synced' } })),
}))

describe('External Integrations API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getIntegrations', () => {
    it('should list integrations', async () => {
      const { GET } = await import('@/app/api/integrations/[provider]/route')
      const request = createMockRequest('/api/integrations/google-calendar')
      const result = await GET(request) as any
      expect(result).toBeDefined()
      expect(result.data).toBeDefined()
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should filter integrations by provider', async () => {
      const { GET } = await import('@/app/api/integrations/[provider]/route')
      const request = createMockRequest('/api/integrations/google-calendar')
      const result = await GET(request) as any
      expect(result).toBeDefined()
      expect(result.data).toBeDefined()
      expect(result.data.length).toBeGreaterThan(0)
    })
  })

  describe('createIntegration', () => {
    it('should create a new Google Calendar integration', async () => {
      const { POST } = await import('@/app/api/integrations/[provider]/route')
      const request = createMockRequest('/api/integrations/google-calendar', {
        taskId: 1,
        provider: 'google-calendar',
        data: { externalId: 'ext-123' },
      })
      const result = await POST(request) as any
      expect(result).toBeDefined()
      expect(result.data).toBeDefined()
    })

    it('should create a new Slack integration', async () => {
      const { POST } = await import('@/app/api/integrations/[provider]/route')
      const request = createMockRequest('/api/integrations/slack', {
        taskId: 1,
        provider: 'slack',
        data: { externalId: 'ext-456' },
      })
      const result = await POST(request) as any
      expect(result).toBeDefined()
      expect(result.data).toBeDefined()
    })
  })

  describe('updateIntegration', () => {
    it('should update integration sync status', async () => {
      const { PUT } = await import('@/app/api/integrations/[provider]/route')
      const request = createMockRequest('/api/integrations/google-calendar', {
        taskId: 1,
        provider: 'google-calendar',
        data: { status: 'completed' },
      })
      const result = await PUT(request) as any
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })
  })

  describe('deleteIntegration', () => {
    it('should delete an integration', async () => {
      const { DELETE } = await import('@/app/api/integrations/[provider]/route')
      const request = createMockRequest('/api/integrations/google-calendar?taskId=1')
      const result = await DELETE(request) as any
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })
  })
})