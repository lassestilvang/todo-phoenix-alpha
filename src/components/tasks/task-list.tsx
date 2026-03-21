"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Plus, Search, Filter, MoreVertical, Check, Clock, 
  AlertCircle, Tag, Calendar, ChevronDown, ChevronUp,
  Play, Pause, Square
} from "lucide-react"
import { cn } from "@/lib/utils"
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
import { TaskDetailModal } from "./task-detail-modal"

interface TaskListProps {
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

export function TaskList({
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
}: TaskListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set())

  const toggleExpanded = (taskId: number) => {
    setExpandedTasks(prev => {
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

  const filteredTasks = tasks.filter(task => 
    showCompleted ? true : !task.is_completed
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Tasks</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onToggleShowCompleted}>
              {showCompleted ? "Hide Completed" : "Show Completed"}
            </Button>
            <Button onClick={onCreateTask}>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Task List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredTasks.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-muted-foreground"
              >
                <Check className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No tasks yet</p>
                <p className="text-sm">Create your first task to get started</p>
              </motion.div>
            ) : (
              filteredTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className={cn(
                      "p-4 hover:shadow-md transition-shadow cursor-pointer",
                      task.is_completed && "opacity-60"
                    )}
                    onDoubleClick={() => onViewTaskDetails?.(task.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <Checkbox
                        checked={task.is_completed === 1}
                        onCheckedChange={() => onToggleCompleted(task.id)}
                        className="mt-1"
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
                            >
                              {priorityLabels[task.priority]}
                            </Badge>

                            {/* Overdue Badge */}
                            {isOverdue(task) && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Overdue
                              </Badge>
                            )}

                            {/* Actions Dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onEditTask(task.id)}>
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => onDeleteTask(task.id)}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Task Details */}
                        <AnimatePresence>
                          {expandedTasks.has(task.id) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-3 space-y-2"
                            >
                              <Separator />
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                {task.date && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    <span>{format(new Date(task.date), "MMM d, yyyy")}</span>
                                  </div>
                                )}
                                {task.deadline && (
                                  <div className={cn(
                                    "flex items-center gap-2",
                                    isOverdue(task) && "text-red-500"
                                  )}>
                                    <Clock className="h-4 w-4" />
                                    <span>{format(new Date(task.deadline), "MMM d, yyyy HH:mm")}</span>
                                  </div>
                                )}
                                {task.estimate_minutes > 0 && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <span>Est: {task.estimate_minutes}m</span>
                                  </div>
                                )}
                                {task.actual_minutes > 0 && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Play className="h-4 w-4" />
                                    <span>Actual: {task.actual_minutes}m</span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Task Detail Modal */}
      {selectedTaskDetails && (
        <TaskDetailModal
          open={!!selectedTaskDetails}
          onClose={onCloseTaskDetails || (() => {})}
          task={selectedTaskDetails}
          onToggleSubtaskComplete={(subtaskId) => {
            // TODO: Implement subtask toggle
            console.log("Toggle subtask:", subtaskId)
          }}
          onDeleteSubtask={(subtaskId) => {
            // TODO: Implement subtask deletion
            console.log("Delete subtask:", subtaskId)
          }}
          onEditSubtask={(subtaskId) => {
            // TODO: Implement subtask editing
            console.log("Edit subtask:", subtaskId)
          }}
          onCreateSubtask={() => {
            // TODO: Implement subtask creation
            console.log("Create subtask")
          }}
        />
      )}
    </div>
  )
}
