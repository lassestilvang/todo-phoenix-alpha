"use client"

import * as React from "react"
import { useReducedMotion } from "framer-motion"
import {
  Check, Clock, AlertCircle, Calendar, Search, Play, Plus, MoreVertical, GripVertical
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type { Task, Priority, TaskWithDetails } from "@/lib/types"
import { format } from "date-fns"
import {
  DndContext,
  closestCenter,
  KeyboardCode,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { TaskDetailModal } from "./task-detail-modal"

interface AccessibleTaskListProps {
  tasks: Task[]
  showCompleted: boolean
  onToggleCompleted: (taskId: number) => void
  onDeleteTask: (taskId: number) => void
  onEditTask: (taskId: number) => void
  onCreateTask: () => void
  onToggleShowCompleted: () => void
  onSearch: (query: string) => void
  searchQuery: string
  onViewTaskDetails?: (taskId: number) => void
  selectedTaskDetails?: TaskWithDetails | null
  onCloseTaskDetails?: () => void
  onReorderTasks?: (newOrder: Task[]) => void
}

const priorityColors: Record<Priority, string> = {
  high: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
  low: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  none: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
}

const priorityLabels: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
}

function AccessibleSortableTaskCard({
  task,
  onToggleCompleted,
  onDeleteTask,
  onEditTask,
  onViewTaskDetails,
  expandedTasks,
  toggleExpanded,
  isRunning,
  onStartTimer,
  onStopTimer,
  isSelected = false,
  onSelectToggle = () => {},
}: {
  task: Task
  onToggleCompleted: (taskId: number) => void
  onDeleteTask: (taskId: number) => void
  onEditTask: (taskId: number) => void
  onViewTaskDetails?: (taskId: number) => void
  expandedTasks: Set<number>
  toggleExpanded: (taskId: number) => void
  isRunning: boolean
  onStartTimer: () => void
  onStopTimer: () => void
  isSelected?: boolean
  onSelectToggle?: () => void
}) {
  const reducedMotion = useReducedMotion()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id.toString() })

  const style = {
    transform: transform
      ? `translate3d(0, 0, 0) scale(${isDragging ? 0.98 : 1})`
      : undefined,
    transition: reducedMotion ? "none" : transition,
    opacity: isDragging ? 0.5 : undefined,
  }

  const isOverdue = (task: Task) => {
    if (!task.deadline || task.is_completed) return false
    return new Date(task.deadline) < new Date()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "Enter":
        event.preventDefault()
        onViewTaskDetails?.(task.id)
        break
      case " ":
        event.preventDefault()
        onToggleCompleted(task.id)
        break
      case "e":
        event.preventDefault()
        onEditTask(task.id)
        break
      case "d":
        event.preventDefault()
        onDeleteTask(task.id)
        break
      case "t":
        event.preventDefault()
        if (isRunning) {
          onStopTimer()
        } else {
          onStartTimer()
        }
        break
      case "x":
        event.preventDefault()
        onSelectToggle()
        break
      default:
        break
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="listitem"
      aria-selected={isSelected}
      aria-label={`${task.name}${task.description ? `, ${task.description}` : ""}, ${
        task.is_completed ? "completed" : "incomplete"
      } priority ${priorityLabels[task.priority]}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="select-none focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
    >
      <Card
        className={cn(
          "p-4 hover:shadow-md transition-shadow cursor-pointer group",
          task.is_completed && "opacity-60",
          isDragging && "shadow-lg",
          isSelected && "ring-2 ring-primary/20"
        )}
        onDoubleClick={() => onViewTaskDetails?.(task.id)}
        onClick={() => toggleExpanded(task.id)}
      >
        <div className="flex items-start gap-3">
          {/* Drag handle */}
          <div
            className="cursor-grab rounded p-1 hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
            {...attributes}
            {...listeners}
            aria-label="Drag handle"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Checkbox */}
          <Checkbox
            checked={task.is_completed === 1}
            onCheckedChange={() => onToggleCompleted(task.id)}
            className="mt-1"
            aria-label={task.is_completed === 1 ? "Mark as incomplete" : "Mark as complete"}
          />

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3
                  className={cn(
                    "font-medium cursor-pointer",
                    task.is_completed && "line-through text-muted-foreground"
                  )}
                  onClick={() => toggleExpanded(task.id)}
                  aria-label={task.name}
                >
                  {task.name}
                </h3>
                {task.description && (
                  <p
                    className={cn(
                      "text-sm text-muted-foreground mt-1 line-clamp-2",
                      task.is_completed && "line-through"
                    )}
                  >
                    {task.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Priority Badge */}
                <Badge
                  variant="outline"
                  className={cn("text-xs", priorityColors[task.priority])}
                  aria-label={`Priority: ${priorityLabels[task.priority]}`}
                >
                  {priorityLabels[task.priority]}
                </Badge>

                {/* Overdue Badge */}
                {isOverdue(task) && (
                  <Badge variant="destructive" className="text-xs" aria-label="Overdue">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Overdue
                  </Badge>
                )}

                {/* Actions Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="More actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4}>
                    <DropdownMenuItem onClick={() => onEditTask(task.id)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDeleteTask(task.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                    {isRunning ? (
                      <DropdownMenuItem onClick={onStopTimer}>
                        Stop Timer
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={onStartTimer}>
                        Start Timer
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Task Details */}
            <div className="flex-1">
              {expandedTasks.has(task.id) && (
                <div className="mt-3 space-y-2">
                  <Separator />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {task.date && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                        <span>{format(new Date(task.date), "MMM d, yyyy")}</span>
                      </div>
                    )}
                    {task.deadline && (
                      <div
                        className={cn(
                          "flex items-center gap-2",
                          isOverdue(task) && "text-red-500"
                        )}
                      >
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {format(new Date(task.deadline), "MMM d, yyyy HH:mm")}
                        </span>
                      </div>
                    )}
                    {task.estimate_minutes > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        <span>Est: {task.estimate_minutes}m</span>
                      </div>
                    )}
                    {task.actual_minutes > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Play className="h-4 w-4" aria-hidden="true" />
                        <span>Actual: {task.actual_minutes}m</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export function AccessibleTaskList({
  tasks,
  showCompleted,
  onToggleCompleted,
  onDeleteTask,
  onEditTask,
  onCreateTask,
  onToggleShowCompleted,
  onSearch,
  searchQuery,
  onViewTaskDetails,
  selectedTaskDetails,
  onCloseTaskDetails,
  onReorderTasks,
}: AccessibleTaskListProps) {
  const [expandedTasks, setExpandedTasks] = React.useState<Set<number>>(new Set())
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [selectedTasks, setSelectedTasks] = React.useState<Set<number>>(new Set())

  const toggleExpanded = (taskId: number) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  const isOverdue = (task: Task) => {
    if (!task.deadline || task.is_completed) return false
    return new Date(task.deadline) < new Date()
  }

  const filteredTasks = tasks.filter((task) =>
    showCompleted ? true : !task.is_completed
  )

  // Keyboard shortcuts for accessibility
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not focused on an input/textarea
      const target = event.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return
      }

      switch (event.key) {
        case "n":
          if (event.ctrlKey) {
            event.preventDefault()
            onCreateTask()
          }
          break
        case "a":
          if (event.ctrlKey) {
            event.preventDefault()
            setSelectedTasks(new Set(filteredTasks.map((t) => t.id)))
          }
          break
        case "Escape":
          if (event.ctrlKey) {
            event.preventDefault()
            onToggleShowCompleted()
          }
          break
        case "Backspace":
          if (selectedTasks.size > 0) {
            event.preventDefault()
            selectedTasks.forEach((id) => onDeleteTask(id))
            setSelectedTasks(new Set())
          }
          break
        default:
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onCreateTask, onToggleShowCompleted, selectedTasks, filteredTasks])

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (active && over && active.id !== over.id && onReorderTasks) {
      const oldIndex = filteredTasks.findIndex((task) => task.id === Number(active.id))
      const newIndex = filteredTasks.findIndex((task) => task.id === Number(over.id))
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(filteredTasks, oldIndex, newIndex)
        onReorderTasks(reordered)
      }
    }
  }

  return (
    <div className="flex flex-col h-full" role="region" aria-label="Task list">
      {/* Header */}
      <div className="border-b p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Tasks</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleShowCompleted}
              aria-label={showCompleted ? "Hide completed tasks" : "Show completed tasks"}
            >
              {showCompleted ? "Hide Completed" : "Show Completed"}
            </Button>
            <Button
              onClick={onCreateTask}
              aria-label="Create new task"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <label htmlFor="task-search" className="sr-only">
            Search tasks
          </label>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="task-search"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-10"
            aria-label="Search tasks, type to filter"
          />
        </div>
      </div>

      {/* Task List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2" role="list">
          <DndContext
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            // @ts-ignore
collisionMode="horizontal"
          >
            <SortableContext items={filteredTasks.map((t) => t.id.toString())} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {filteredTasks.length === 0 ? (
                  <div
                    className="text-center py-12 text-muted-foreground"
                    role="img"
                    aria-label="No tasks yet, empty state"
                  >
                    <Check className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
                    <p className="text-lg font-medium">No tasks yet</p>
                    <p className="text-sm">Create your first task to get started</p>
                    <Button
                      onClick={onCreateTask}
                      className="mt-4"
                      aria-label="Create your first task"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Get Started
                    </Button>
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <AccessibleSortableTaskCard
                      key={task.id}
                      task={task}
                      onToggleCompleted={onToggleCompleted}
                      onDeleteTask={onDeleteTask}
                      onEditTask={onEditTask}
                      onViewTaskDetails={onViewTaskDetails}
                      expandedTasks={expandedTasks}
                      toggleExpanded={toggleExpanded}
                      isRunning={false}
                      onStartTimer={() => console.log("Start timer")}
                      onStopTimer={() => console.log("Stop timer")}
                      isSelected={selectedTasks.has(task.id)}
                      onSelectToggle={() => {
                        const newSelected = new Set(selectedTasks)
                        if (newSelected.has(task.id)) {
                          newSelected.delete(task.id)
                        } else {
                          newSelected.add(task.id)
                        }
                        setSelectedTasks(newSelected)
                      }}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </ScrollArea>

      {/* Task Detail Modal */}
      {selectedTaskDetails && (
        <TaskDetailModal
          open={!!selectedTaskDetails}
          onClose={onCloseTaskDetails || (() => {})}
          task={selectedTaskDetails}
          onToggleSubtaskComplete={(subtaskId) => {
            console.log("Toggle subtask:", subtaskId)
          }}
          onDeleteSubtask={(subtaskId) => {
            console.log("Delete subtask:", subtaskId)
          }}
          onEditSubtask={(subtaskId) => {
            console.log("Edit subtask:", subtaskId)
          }}
          onCreateSubtask={() => {
            console.log("Create subtask")
          }}
        />
      )}
    </div>
  )
}