import { NextRequest, NextResponse } from 'next/server';
import { getTasks, getTasksByListId, createTask, updateTask, deleteTask, toggleTaskComplete, searchTasks, getSubtasks, createSubtask, updateSubtask, toggleSubtaskComplete, deleteSubtask, getTimeEntries, startTimeEntry, stopTimeEntry, getActiveTimeEntry, getTotalTimeForTask, createTaskFromNLP, getTaskSuggestions, addAttachmentToTask, createReminder, createTaskFromVoice, exportDatabaseAsJson, createBackup, listBackups, addGoogleCalendarEvent, addSlackNotification, scheduleEmailReminder, getExternalIntegrations, deleteExternalIntegration, getTaskDependencies, addTaskDependency, removeTaskDependency, getDependentTasks, getDependencyChain, validateDependencies, getSmartTemplates, createTemplate } from '@/app/actions/tasks';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('listId');
    const status = searchParams.get('status');
    const includeCompleted = searchParams.get('includeCompleted') === 'true';
    const query = searchParams.get('query');

    if (listId) {
      return NextResponse.json(await getTasksByListId(parseInt(listId), includeCompleted));
    }

    if (query) {
      return NextResponse.json(await searchTasks(query, includeCompleted));
    }

    return NextResponse.json(await getTasks());
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'create') {
      return NextResponse.json(await createTask(body.data));
    }
    if (body.action === 'createSubtask') {
      return NextResponse.json(await createSubtask(body.taskId, body.data));
    }
    if (body.action === 'createReminder') {
      return NextResponse.json(await createReminder(body.taskId, body.time));
    }
    if (body.action === 'createBackup') {
      return NextResponse.json(await createBackup(body.description));
    }
    if (body.action === 'createTemplate') {
      return NextResponse.json(await createTemplate(body.name, body.description, body.listId, body.templateData));
    }
    if (body.action === 'addDependency') {
      return NextResponse.json(await addTaskDependency(body.taskId, body.dependsOnTaskId));
    }
    if (body.action === 'startTimeEntry') {
      return NextResponse.json(await startTimeEntry(body.taskId));
    }
    if (body.action === 'googleCalendar') {
      return NextResponse.json(await addGoogleCalendarEvent(body.taskId, body.summary, body.description, body.start, body.end));
    }
    if (body.action === 'slack') {
      return NextResponse.json(await addSlackNotification(body.taskId, body.message));
    }
    if (body.action === 'emailReminder') {
      return NextResponse.json(await scheduleEmailReminder(body.taskId, body.email, body.message, body.sendAt));
    }
    if (body.action === 'nlp') {
      return NextResponse.json(await createTaskFromNLP(body.text, body.listId));
    }
    if (body.action === 'voice') {
      return NextResponse.json(await createTaskFromVoice(body.text, body.listId));
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const subtaskId = searchParams.get('subtaskId');

    if (subtaskId) {
      const body = await request.json();
      return NextResponse.json(await updateSubtask(parseInt(subtaskId), body));
    }

    if (taskId) {
      const body = await request.json();
      return NextResponse.json(await updateTask(parseInt(taskId), body));
    }

    return NextResponse.json({ error: 'Task ID or Subtask ID required' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const subtaskId = searchParams.get('subtaskId');

    if (subtaskId) {
      await deleteSubtask(parseInt(subtaskId));
      return NextResponse.json({ success: true });
    }

    if (taskId) {
      await deleteTask(parseInt(taskId));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Task ID or Subtask ID required' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (taskId && searchParams.get('action') === 'complete') {
      return NextResponse.json(await toggleTaskComplete(parseInt(taskId)));
    }

    if (taskId && searchParams.get('action') === 'start-time') {
      return NextResponse.json(await startTimeEntry(parseInt(taskId)));
    }

    if (taskId && searchParams.get('action') === 'stop-time') {
      return NextResponse.json(await stopTimeEntry(parseInt(taskId)));
    }

    if (taskId && searchParams.get('action') === 'complete-subtask') {
      const subtaskId = searchParams.get('subtaskId');
      if (subtaskId) {
        return NextResponse.json(await toggleSubtaskComplete(parseInt(subtaskId)));
      }
    }

    return NextResponse.json({ error: 'Invalid PATCH request' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to patch task' }, { status: 500 });
  }
}

export async function GET_SUBTASKS(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (taskId) {
      return NextResponse.json(await getSubtasks(parseInt(taskId)));
    }

    return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch subtasks' }, { status: 500 });
  }
}