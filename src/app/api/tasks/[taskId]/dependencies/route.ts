import { NextRequest, NextResponse } from 'next/server';
import {
  getTaskDependencies,
  addTaskDependency,
  removeTaskDependency,
  getDependentTasks,
  getDependencyChain,
  validateDependencies
} from '@/app/actions/tasks';

// GET /api/tasks/:taskId/dependencies - Get all dependencies for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const taskIdNum = parseInt(taskId, 10);

    if (isNaN(taskIdNum)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    const dependencies = await getTaskDependencies(taskIdNum);
    const dependents = await getDependentTasks(taskIdNum);
    const chain = await getDependencyChain(taskIdNum);
    const validation = await validateDependencies(taskIdNum);

    return NextResponse.json({
      dependencies,
      dependents,
      chain,
      validation
    });
  } catch (error) {
    console.error('Error fetching dependencies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tasks/:taskId/dependencies - Add a new dependency
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const taskIdNum = parseInt(taskId, 10);

    if (isNaN(taskIdNum)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    const body = await request.json();
    const { dependsOnTaskId } = body;

    if (!dependsOnTaskId || isNaN(parseInt(dependsOnTaskId, 10))) {
      return NextResponse.json({ error: 'dependsOnTaskId is required and must be a number' }, { status: 400 });
    }

    const dependsOnTaskIdNum = parseInt(dependsOnTaskId, 10);
    await addTaskDependency(taskIdNum, dependsOnTaskIdNum);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding dependency:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/tasks/:taskId/dependencies/:dependsOnTaskId - Remove a dependency
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const taskIdNum = parseInt(taskId, 10);

    if (isNaN(taskIdNum)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    // Get the dependency ID from URL search params
    const url = new URL(request.url);
    const dependsOnTaskId = url.searchParams.get('dependsOnTaskId');

    if (!dependsOnTaskId || isNaN(parseInt(dependsOnTaskId, 10))) {
      return NextResponse.json({ error: 'dependsOnTaskId query parameter is required' }, { status: 400 });
    }

    const dependsOnTaskIdNum = parseInt(dependsOnTaskId, 10);
    await removeTaskDependency(taskIdNum, dependsOnTaskIdNum);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing dependency:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}