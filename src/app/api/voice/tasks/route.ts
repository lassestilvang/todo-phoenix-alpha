import { NextResponse } from 'next/server';
import { getVoiceEngine } from '@/lib/voice/VoiceEngine';
import { encryptionService } from '@/lib/security/encryption';
import { listOperations, taskOperations, reminderOperations } from '@/lib/db';
import db from '@/lib/db/schema';

export async function POST(request: Request) {
  try {
    const { text, listId, userId = 'default' } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required for voice command' },
        { status: 400 }
      );
    }

    // Validate input
    if (text.length > 500) {
      return NextResponse.json(
        { error: 'Voice command too long (max 500 characters)' },
        { status: 400 }
      );
    }

    // Process voice command
    const voiceEngine = getVoiceEngine();
    const command = await voiceEngine.processVoiceCommand(text);

    if (!command) {
      return NextResponse.json(
        { error: 'Failed to process voice command' },
        { status: 500 }
      );
    }

    // Handle different command types
    switch (command.type) {
      case 'create_task':
        return await handleCreateTask(command, listId, userId);

      case 'query_tasks':
        return await handleQueryTasks(command, userId);

      case 'set_reminder':
        return await handleReminder(command, userId);

      case 'update_task':
        return await handleUpdateTask(command, userId);

      case 'delete_task':
        return await handleDeleteTask(command, userId);

      default:
        return NextResponse.json(
          { error: `Command type '${command.type}' not yet implemented` },
          { status: 501 }
        );
    }
  } catch (error) {
    console.error('Voice API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleCreateTask(command: any, listId: string | undefined, userId: string) {
  // Get default list or use provided
  const lists = listOperations.getAll();
  const defaultList = lists.length > 0 ? lists[0] : null;
  const targetListId = parseInt(listId || (defaultList ? String(defaultList.id) : '1'), 10);

  // Create task data
  const taskData = {
    name: command.entities.taskName || 'Untitled Task',
    description: command.entities.description || undefined,
    deadline: command.entities.deadline || undefined,
    priority: command.entities.priority || 'none',
    estimate_minutes: command.entities.duration || undefined,
    list_id: targetListId,
  };

  // Create the task
  const task = taskOperations.create(taskData);

  return NextResponse.json({
    success: true,
    message: `Task created: ${taskData.name}`,
    task: task
  });
}

async function handleQueryTasks(command: any, userId: string) {
  // Get tasks
  const tasks = await getTasks();

  return NextResponse.json({
    success: true,
    tasks: tasks.map(t => ({
      id: t.id,
      name: t.name,
      completed: t.is_completed,
      priority: t.priority,
      deadline: t.deadline
    })),
    count: tasks.length
  });
}

async function handleReminder(command: any, userId: string) {
  if (!command.entities.taskId) {
    return NextResponse.json(
      { error: 'Task ID required for reminder' },
      { status: 400 }
    );
  }

  const reminder = reminderOperations.create(
    command.entities.taskId,
    command.entities.reminderTime
  );

  return NextResponse.json({
    success: true,
    message: 'Reminder set successfully',
    reminder: {
      id: reminder.id,
      time: reminder.time,
      is_sent: reminder.is_sent
    }
  });
}

async function handleUpdateTask(command: any, userId: string) {
  if (!command.entities.taskId) {
    return NextResponse.json(
      { error: 'Task ID required for update' },
      { status: 400 }
    );
  }

  const updates: any = {};
  if (command.entities.taskName) updates.name = command.entities.taskName;
  if (command.entities.description) updates.description = command.entities.description;
  if (command.entities.deadline) updates.deadline = command.entities.deadline;
  if (command.entities.priority) updates.priority = command.entities.priority;
  if (command.entities.duration !== undefined) updates.estimate_minutes = command.entities.duration;

  const task = taskOperations.update(command.entities.taskId, updates);

  return NextResponse.json({
    success: true,
    message: `Task updated: ${task.name}`,
    task: task
  });
}

async function handleDeleteTask(command: any, userId: string) {
  if (!command.entities.taskId) {
    return NextResponse.json(
      { error: 'Task ID required for deletion' },
      { status: 400 }
    );
  }

  taskOperations.delete(command.entities.taskId);

  return NextResponse.json({
    success: true,
    message: 'Task deleted successfully'
  });
}

async function getTasks(): Promise<any[]> {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  return tasks;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const commandText = searchParams.get('text');

  if (!commandText) {
    return NextResponse.json(
      { error: 'Text parameter is required' },
      { status: 400 }
    );
  }

  // Reuse POST logic but as GET for simple testing
  const requestClone = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: commandText })
  });

  return POST(requestClone);
}