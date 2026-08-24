import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/schema'

// Supported providers
type SupportedProvider = 'google-calendar' | 'slack' | 'github' | 'zoom'

// Get integration by provider
function getIntegration(provider: SupportedProvider): {
  get: (taskId: number) => any
  list: () => any[]
  sync: (taskId: number) => Promise<any>
  create: (taskId: number, data: any) => Promise<any>
  update: (taskId: number, data: any) => Promise<any>
  delete: (taskId: number) => Promise<void>
} | null {
  return {
    get: (taskId: number) => db.prepare('SELECT * FROM external_integrations WHERE task_id = ? AND provider = ?').get(taskId, provider),
    list: () => db.prepare('SELECT * FROM external_integrations WHERE provider = ?').all(provider),
    sync: async (taskId: number) => {
      // Sync logic would go here
      const integration = db.prepare('SELECT * FROM external_integrations WHERE task_id = ? AND provider = ?').get(taskId, provider)
      return integration || null
    },
    create: async (taskId: number, data: any) => {
      const result = db.prepare(`
        INSERT INTO external_integrations (task_id, provider, external_id, sync_status, created_at)
        VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)
      `).run(taskId, provider, data.externalId)
      return { id: result.lastInsertRowid, ...data }
    },
    update: async (taskId: number, data: any) => {
      db.prepare(`
        UPDATE external_integrations
        SET sync_status = ?, error_message = ?, last_synced_at = CURRENT_TIMESTAMP
        WHERE task_id = ? AND provider = ?
      `).run(data.status, data.error, taskId, provider)
    },
    delete: async (taskId: number) => {
      db.prepare('DELETE FROM external_integrations WHERE task_id = ? AND provider = ?').run(taskId, provider)
    }
  }
}

// Google Calendar API integration
async function syncWithGoogleCalendar(task: any, tokens: any): Promise<any> {
  // This would integrate with Google Calendar API
  // For now, return a mock response
  return {
    success: true,
    message: 'Google Calendar integration not fully implemented yet',
    taskId: task.id
  }
}

// Slack API integration
async function syncWithSlack(task: any): Promise<any> {
  // This would integrate with Slack API
  // For now, return a mock response
  return {
    success: true,
    message: 'Slack integration not fully implemented yet',
    taskId: task.id
  }
}

// Main route handler
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider') as SupportedProvider
    const taskId = searchParams.get('taskId') ? parseInt(searchParams.get('taskId')!, 10) : undefined

    if (!provider || !['google-calendar', 'slack', 'github', 'zoom'].includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing provider parameter' },
        { status: 400 }
      )
    }

    const integration = getIntegration(provider)
    if (!integration) {
      return NextResponse.json(
        { success: false, error: 'Provider not supported' },
        { status: 404 }
      )
    }

    if (taskId) {
      const result = await integration.sync(taskId)
      return NextResponse.json({
        success: true,
        data: result
      })
    }

    // List all integrations for provider
    const integrations = integration.list()
    return NextResponse.json({
      success: true,
      data: integrations
    })
  } catch (error) {
    console.error('Integration API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process integration request' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, provider, data } = body

    if (!provider || !['google-calendar', 'slack', 'github', 'zoom'].includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider' },
        { status: 400 }
      )
    }

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      )
    }

    const integration = getIntegration(provider)
    if (!integration) {
      return NextResponse.json(
        { success: false, error: 'Provider not supported' },
        { status: 404 }
      )
    }

    const result = await integration.create(taskId, data)
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Integration API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create integration' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, provider, data } = body

    if (!provider || !['google-calendar', 'slack', 'github', 'zoom'].includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider' },
        { status: 400 }
      )
    }

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      )
    }

    const integration = getIntegration(provider)
    if (!integration) {
      return NextResponse.json(
        { success: false, error: 'Provider not supported' },
        { status: 404 }
      )
    }

    await integration.update(taskId, data)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Integration API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update integration' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider') as SupportedProvider
    const taskId = searchParams.get('taskId') ? parseInt(searchParams.get('taskId')!, 10) : undefined

    if (!provider || !['google-calendar', 'slack', 'github', 'zoom'].includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider' },
        { status: 400 }
      )
    }

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      )
    }

    const integration = getIntegration(provider)
    if (!integration) {
      return NextResponse.json(
        { success: false, error: 'Provider not supported' },
        { status: 404 }
      )
    }

    await integration.delete(taskId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Integration API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete integration' },
      { status: 500 }
    )
  }
}