"use server"

import { revalidatePath } from "next/cache"
import { listOperations, taskOperations, labelOperations, subtaskOperations, timeEntryOperations } from "@/lib/db"
import type { TaskFormData, SubtaskFormData } from "@/lib/types"

// List actions
export async function getLists() {
  return listOperations.getAll()
}

export async function createList(name: string, color: string, emoji: string, icon: string) {
  const list = listOperations.create(name, color, emoji, icon)
  revalidatePath("/")
  return list
}

export async function updateList(id: number, updates: { name?: string; color?: string; emoji?: string; icon?: string }) {
  const list = listOperations.update(id, updates)
  revalidatePath("/")
  return list
}

export async function deleteList(id: number) {
  listOperations.delete(id)
  revalidatePath("/")
}

// Task actions
export async function getTasks(includeCompleted: boolean = true) {
  return taskOperations.getAll(includeCompleted)
}

export async function getTaskById(id: number) {
  return taskOperations.getByIdWithDetails(id)
}

export async function getTasksByListId(listId: number, includeCompleted: boolean = true) {
  return taskOperations.getByListId(listId, includeCompleted)
}

export async function getTasksByDate(date: string, includeCompleted: boolean = true) {
  return taskOperations.getByDate(date, includeCompleted)
}

export async function getTasksByDateRange(startDate: string, endDate: string, includeCompleted: boolean = true) {
  return taskOperations.getByDateRange(startDate, endDate, includeCompleted)
}

export async function getUpcomingTasks(fromDate: string, includeCompleted: boolean = true) {
  return taskOperations.getUpcoming(fromDate, includeCompleted)
}

export async function getOverdueTasks(currentDate: string) {
  return taskOperations.getOverdue(currentDate)
}

export async function createTask(data: TaskFormData) {
  const task = taskOperations.create(data)
  revalidatePath("/")
  return task
}

export async function updateTask(id: number, updates: Partial<TaskFormData>) {
  const task = taskOperations.update(id, updates)
  revalidatePath("/")
  return task
}

export async function toggleTaskComplete(id: number) {
  const task = taskOperations.toggleComplete(id)
  revalidatePath("/")
  return task
}

export async function deleteTask(id: number) {
  taskOperations.delete(id)
  revalidatePath("/")
}

export async function searchTasks(query: string, includeCompleted: boolean = true) {
  return taskOperations.search(query, includeCompleted)
}

// Label actions
export async function getLabels() {
  return labelOperations.getAll()
}

export async function createLabel(name: string, color: string, emoji: string) {
  const label = labelOperations.create(name, color, emoji)
  revalidatePath("/")
  return label
}

export async function updateLabel(id: number, updates: { name?: string; color?: string; emoji?: string }) {
  const label = labelOperations.update(id, updates)
  revalidatePath("/")
  return label
}

export async function deleteLabel(id: number) {
  labelOperations.delete(id)
  revalidatePath("/")
}

// Subtask actions
export async function getSubtasks(taskId: number) {
  return subtaskOperations.getAll(taskId)
}

export async function createSubtask(taskId: number, data: SubtaskFormData) {
  const subtask = subtaskOperations.create(taskId, data)
  revalidatePath("/")
  return subtask
}

export async function updateSubtask(id: number, updates: Partial<SubtaskFormData>) {
  const subtask = subtaskOperations.update(id, updates)
  revalidatePath("/")
  return subtask
}

export async function toggleSubtaskComplete(id: number) {
  const subtask = subtaskOperations.toggleComplete(id)
  revalidatePath("/")
  return subtask
}

export async function deleteSubtask(id: number) {
  subtaskOperations.delete(id)
  revalidatePath("/")
}

// Time entry actions
export async function getTimeEntries(taskId: number) {
  return timeEntryOperations.getAll(taskId)
}

export async function startTimeEntry(taskId: number) {
  const timeEntry = timeEntryOperations.create(taskId, new Date())
  revalidatePath("/")
  return timeEntry
}

export async function stopTimeEntry(id: number, stoppedAt: Date, durationMinutes: number) {
  const timeEntry = timeEntryOperations.stop(id, stoppedAt, durationMinutes)
  revalidatePath("/")
  return timeEntry
}

export async function getActiveTimeEntry(taskId: number) {
  return timeEntryOperations.getActiveEntry(taskId)
}

export async function getTotalTimeForTask(taskId: number) {
  return timeEntryOperations.getTotalTimeForTask(taskId)
}
