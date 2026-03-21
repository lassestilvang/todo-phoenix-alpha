"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { TaskList } from "@/components/tasks/task-list"
import { TaskFormDialog } from "@/components/tasks/task-form-dialog"
import { 
  getLists, getTasks, getTasksByListId, getTasksByDate,
  getTasksByDateRange, getUpcomingTasks, getOverdueTasks,
  getLabels, createTask, toggleTaskComplete, deleteTask,
  updateTask, createList, createLabel, getTaskById
} from "@/app/actions/tasks"
import type { Task, List, Label, TaskWithDetails, TaskFormData } from "@/lib/types"
import { format } from "date-fns"

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const view = searchParams.get("view") || "today"
  const listId = searchParams.get("list")
  const labelId = searchParams.get("label")
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [lists, setLists] = useState<List[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [showCompleted, setShowCompleted] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [overdueCount, setOverdueCount] = useState(0)
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<TaskWithDetails | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [listsData, labelsData] = await Promise.all([
        getLists(),
        getLabels()
      ])
      setLists(listsData)
      setLabels(labelsData)

      let tasksData: Task[] = []
      const today = format(new Date(), "yyyy-MM-dd")
      const nextWeek = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")

      if (listId) {
        tasksData = await getTasksByListId(parseInt(listId), showCompleted)
      } else if (labelId) {
        // For now, get all tasks and filter by label
        tasksData = await getTasks(showCompleted)
        tasksData = tasksData.filter(() => {
          // TODO: Implement label filtering
          return true
        })
      } else {
        switch (view) {
          case "today":
            tasksData = await getTasksByDate(today, showCompleted)
            break
          case "next_7_days":
            tasksData = await getTasksByDateRange(today, nextWeek, showCompleted)
            break
          case "upcoming":
            tasksData = await getUpcomingTasks(today, showCompleted)
            break
          case "all":
            tasksData = await getTasks(showCompleted)
            break
          default:
            tasksData = await getTasksByDate(today, showCompleted)
        }
      }

      // Apply search filter
      if (searchQuery) {
        tasksData = tasksData.filter(task =>
          task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      }

      setTasks(tasksData)
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [view, listId, labelId, showCompleted, searchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    // Check for overdue tasks
    const checkOverdue = async () => {
      const overdue = await getOverdueTasks(new Date().toISOString())
      setOverdueCount(overdue.length)
    }
    checkOverdue()
    // Check every minute
    const interval = setInterval(checkOverdue, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleToggleComplete = async (taskId: number) => {
    await toggleTaskComplete(taskId)
    loadData()
  }

  const handleDeleteTask = async (taskId: number) => {
    if (confirm("Are you sure you want to delete this task?")) {
      await deleteTask(taskId)
      loadData()
    }
  }

  const handleEditTask = (taskId: number) => {
    setEditingTaskId(taskId)
    setIsTaskFormOpen(true)
  }

  const handleCreateTask = () => {
    setEditingTaskId(null)
    setIsTaskFormOpen(true)
  }

  const handleSaveTask = async (data: any) => {
    if (editingTaskId) {
      await updateTask(editingTaskId, data)
    } else {
      await createTask(data)
    }
    loadData()
  }

  const handleCreateList = () => {
    // TODO: Implement list creation dialog
    const name = prompt("Enter list name:")
    if (name) {
      const color = "#6366f1"
      const emoji = "📋"
      const icon = "List"
      createList(name, color, emoji, icon)
    }
  }

  const handleCreateLabel = () => {
    // TODO: Implement label creation dialog
    const name = prompt("Enter label name:")
    if (name) {
      const color = "#ec4899"
      const emoji = "🏷️"
      createLabel(name, color, emoji)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    loadData()
  }

  const handleViewTaskDetails = async (taskId: number) => {
    const taskDetails = await getTaskById(taskId)
    if (taskDetails) {
      setSelectedTaskDetails(taskDetails)
    }
  }

  const handleCloseTaskDetails = () => {
    setSelectedTaskDetails(null)
  }

  const convertTaskToFormData = (task: Task) => {
    return {
      name: task.name,
      description: task.description || undefined,
      date: task.date ? new Date(task.date) : undefined,
      deadline: task.deadline ? new Date(task.deadline) : undefined,
      estimate_minutes: task.estimate_minutes,
      priority: task.priority,
      is_recurring: task.is_recurring === 1,
      recurring_pattern: task.recurring_pattern as any || undefined,
      recurring_custom_value: task.recurring_custom_value || undefined,
      list_id: task.list_id,
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        lists={lists}
        labels={labels}
        overdueCount={overdueCount}
        onCreateList={handleCreateList}
        onCreateLabel={handleCreateLabel}
      />
      
      <main className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <TaskList
            tasks={tasks}
            showCompleted={showCompleted}
            onToggleCompleted={handleToggleComplete}
            onDeleteTask={handleDeleteTask}
            onEditTask={handleEditTask}
            onCreateTask={handleCreateTask}
            onToggleShowCompleted={() => {
              setShowCompleted(!showCompleted)
              loadData()
            }}
            onSearch={handleSearch}
            searchQuery={searchQuery}
            onViewTaskDetails={handleViewTaskDetails}
            selectedTaskDetails={selectedTaskDetails}
            onCloseTaskDetails={handleCloseTaskDetails}
          />
        )}
      </main>

      <TaskFormDialog
        open={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
        onSave={handleSaveTask}
        task={editingTaskId ? convertTaskToFormData(tasks.find(t => t.id === editingTaskId)!) : undefined}
        lists={lists}
        labels={labels}
        mode={editingTaskId ? "edit" : "create"}
      />
    </div>
  )
}
