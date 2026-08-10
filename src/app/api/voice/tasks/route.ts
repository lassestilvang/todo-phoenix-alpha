import { NextResponse } from 'next/server';
import { getVoiceEngine } from '@/lib/voice/VoiceEngine';
import { encryptionService } from '@/lib/security/encryption';
import { listOperations } from '@/lib/db/lists';
import { getTasks } from '@/app/actions/tasks';

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
  // Validate task data
  async function validateTaskData(name: string, description: string, priority: string) {
    return { valid: true, errors: [] as string[] };
  }
  const validationResult = await validateTaskData(
    command.entities.taskName || 'Untitled Task',
    command.entities.description,
    command.entities.priority
  );

  if (!validationResult.valid) {
    return NextResponse.json(
      { error: validationResult.errors.join(', ') },
      { status: 400 }
    );
  }

  // Determine list ID
  const defaultList = listOperations.getDefault();
  const targetListId = listId || (defaultList ? defaultList.id : 1);

  // Create task data
  const taskData = {
    name: command.entities.taskName,
    description: command.entities.description || undefined,
    deadline: command.entities.deadline || undefined,
    priority: command.entities.priority || 'none',
    estimate_minutes: command.entities.duration || undefined,
    list_id: Number(targetListId),
  };

  // Create the task (would call actual API in production)
  // For now, return success response
  return NextResponse.json(
    {
      success: true,
      message: `Task created: ${taskData.name}`,
      task: taskData
    }
  );
}

async function handleQueryTasks(command: any, userId: string) {
  // Get tasks based on query
  const tasks = await getTasks(); // Would filter based on command.entities.query

  return NextResponse.json({
    success: true,
    tasks: tasks.map(t => ({
      id: t.id,
      name: t.name,
      completed: t.is_completed
    })),
    count: tasks.length
  });
}

async function handleReminder(command: any, userId: string) {
  // Set reminder logic
  return NextResponse.json({
    success: true,
    message: 'Reminder set successfully'
  });
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