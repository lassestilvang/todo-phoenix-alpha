import { NextResponse } from 'next/server';
import { TaskDecomposer } from '@/lib/nlp/task-parser';

interface TaskDecomposeRequest {
  taskText: string;
  createSubtasks?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as TaskDecomposeRequest;
    const { taskText, createSubtasks = false } = body;

    if (!taskText || typeof taskText !== 'string' || taskText.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Task text is required for decomposition' },
        { status: 400 }
      );
    }

    // Decompose the task using intelligent decomposition
    const decomposition = TaskDecomposer.decompose(taskText);

    // Get smart suggestions for the task
    const smartSuggestions = TaskDecomposer.smartSuggestions(taskText);

    let formattedSubtasks = decomposition.subtasks.map((subtask) => ({
      name: subtask.name,
      description: subtask.description,
      priority: subtask.priority,
      estimate_minutes: subtask.estimate_minutes,
      phase: subtask.phase
    }));

    return NextResponse.json({
      success: true,
      originalTask: decomposition.originalTask,
      decomposed: true,
      subtasks: formattedSubtasks,
      suggestions: smartSuggestions.suggestions,
      estimatedComplexity: smartSuggestions.estimatedComplexity,
      breakdownReasoning: decomposition.breakdownReasoning
    });
  } catch (error) {
    console.error('Task decomposition error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to decompose task' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskText = searchParams.get('text');

  if (!taskText) {
    return NextResponse.json(
      { success: false, error: 'Task text is required' },
      { status: 400 }
    );
  }

  // Reuse POST with same parameters
  const body = { taskText };
  const requestClone = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return POST(requestClone);
}