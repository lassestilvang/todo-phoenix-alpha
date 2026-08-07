import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Task, AssignmentStatus, TaskStatus } from '@/types/task';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      const tasks = await prisma.task.findMany({
        where: { createdBy: userId },
        include: {
          agent: true,
          parent: true,
          subtasks: true,
        },
        orderBy: { priority: 'desc' },
      });

      return NextResponse.json({
        success: true,
        tasks,
        count: tasks.length,
      });
    }

    // Return all tasks or filtered by status
    const statusFilter = searchParams.get('status') as TaskStatus | null;

    const where = statusFilter
      ? { status: statusFilter }
      : {};

    const tasks = await prisma.task.findMany({
      where,
      include: {
        agent: true,
        parent: true,
        subtasks: true,
      },
      orderBy: { priority: 'desc' },
    });

    return NextResponse.json({
      success: true,
      tasks,
      count: tasks.length,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      description,
      priority,
      status = TaskStatus.PENDING,
      userId,
      allowedContexts,
      deadline,
      estimatedDuration,
      tags,
    } = body;

    // Validate required fields
    if (!description || priority === undefined) {
      return NextResponse.json(
        { success: false, error: 'Description and priority are required' },
        { status: 400 }
      );
    }

    // Create task in database
    const task = await prisma.task.create({
      data: {
        description,
        priority: Number(priority),
        status,
        allowedContexts: allowedContexts || [],
        deadline: deadline ? new Date(deadline) : null,
        estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null,
        tags: tags || [],
        createdBy: userId ? { connect: { id: userId } } : undefined,
      },
      include: {
        agent: true,
        parent: true,
        subtasks: true,
      },
    });

    return NextResponse.json({
      success: true,
      task,
      message: 'Task created successfully',
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updatePayload: any = {};

    if (updateData.description !== undefined) updatePayload.description = updateData.description;
    if (updateData.priority !== undefined) updatePayload.priority = Number(updateData.priority);
    if (updateData.status !== undefined) updatePayload.status = updateData.status;
    if (updateData.allowedContexts !== undefined) updatePayload.allowedContexts = updateData.allowedContexts;
    if (updateData.deadline !== undefined) updatePayload.deadline = updateData.deadline ? new Date(updateData.deadline) : null;
    if (updateData.estimatedDuration !== undefined) updatePayload.estimatedDuration = Number(updateData.estimatedDuration);
    if (updateData.tags !== undefined) updatePayload.tags = updateData.tags;

    const task = await prisma.task.update({
      where: { id },
      data: updatePayload,
      include: {
        agent: true,
        parent: true,
        subtasks: true,
      },
    });

    return NextResponse.json({
      success: true,
      task,
      message: 'Task updated successfully',
    });
  } catch (error) {
    console.error('Error updating task:', error);
    if (error instanceof prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Soft delete: set status to 'failed' instead of removing
    const task = await prisma.task.update({
      where: { id },
      data: { status: TaskStatus.FAILED },
      include: {
        agent: true,
        parent: true,
        subtasks: true,
      },
    });

    return NextResponse.json({
      success: true,
      task,
      message: 'Task marked as failed',
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    if (error instanceof prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}