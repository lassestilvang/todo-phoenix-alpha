import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/schema'
import { TaskParser } from '@/lib/nlp/task-parser'

interface SyncConflict {
  id: number
  taskId: number
  taskName: string
  externalId: string
  conflictsWith: any[]
}

// Sync tasks to Google Calendar
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, taskId, action, calendarId = 'primary' } = body

    if (!provider || !['google-calendar', 'slack'].includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing provider' },
        { status: 400 }
      )
    }

    if (provider === 'google-calendar') {
      const result = await syncToGoogleCalendar(taskId, calendarId)
      return NextResponse.json({ success: true, data: result })
    }

    if (provider === 'slack') {
      const result = await syncToSlack(taskId)
      return NextResponse.json({ success: true, data: result })
    }

    return NextResponse.json(
      { success: false, error: 'Unknown provider' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Integration sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to sync' },
      { status: 500 }
    )
  }
}

async function syncToGoogleCalendar(taskId: number, calendarId: string) {
  // Get task details
  const task = db.prepare(`
    SELECT t.*, l.name as list_name
    FROM tasks t
    LEFT JOIN lists l ON t.list_id = l.id
    WHERE t.id = ?
  `).get(taskId) as any

  if (!task) {
    throw new Error(`Task ${taskId} not found`)
  }

  // Get or create integration record
  let integration = db.prepare(
    'SELECT * FROM external_integrations WHERE task_id = ? AND provider = ?'
  ).get(taskId, 'google_calendar') as any

  if (!integration) {
    integration = db.prepare(`
      INSERT INTO external_integrations (task_id, provider, external_id, sync_status)
      VALUES (?, ?, ?, 'pending')
    `).run(taskId, 'google_calendar', `task_${taskId}`)
  }

  // In a real implementation, this would call the Google Calendar API
  // For now, store the sync status
  db.prepare(`
    UPDATE external_integrations
    SET sync_status = 'completed', last_synced_at = CURRENT_TIMESTAMP
    WHERE task_id = ? AND provider = ?
  `).run(taskId, 'google_calendar')

  return {
    taskId: task.id,
    taskName: task.name,
    calendarId,
    status: 'synced',
    syncType: 'google_calendar',
    lastSynced: new Date().toISOString()
  }
}

async function syncToSlack(taskId: number) {
  // Get task details
  const task = db.prepare(`
    SELECT t.*, l.name as list_name
    FROM tasks t
    LEFT JOIN lists l ON t.list_id = l.id
    WHERE t.id = ?
  `).get(taskId) as any

  if (!task) {
    throw new Error(`Task ${taskId} not found`)
  }

  // In a real implementation, this would send a Slack message via webhook
  // For now, store the sync status
  db.prepare(`
    INSERT OR REPLACE INTO external_integrations
    (task_id, provider, external_id, sync_status, last_synced_at)
    VALUES (?, ?, ?, 'completed', CURRENT_TIMESTAMP)
  `).run(taskId, 'slack', `slack_msg_${taskId}`)

  return {
    taskId: task.id,
    taskName: task.name,
    status: 'synced',
    syncType: 'slack',
    lastSynced: new Date().toISOString()
  }
}

// Get all sync status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider')

    let query = 'SELECT * FROM external_integrations'
    const params: any[] = []

    if (provider) {
      query += ' WHERE provider = ?'
      params.push(provider)
    }

    query += ' ORDER BY last_synced_at DESC'

    const integrations = db.prepare(query).all(...params)

    return NextResponse.json({
      success: true,
      data: integrations
    })
  } catch (error) {
    console.error('Sync status error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
};