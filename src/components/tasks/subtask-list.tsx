"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Plus, Trash2, Edit2, Check, ChevronDown, ChevronUp,
  Clock, AlertCircle, Calendar
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Subtask, Priority } from "@/lib/types"
import { format } from "date-fns"

interface SubtaskListProps {
  subtasks: Subtask[]
  onToggleComplete: (subtaskId: number) => void
  onDelete: (subtaskId: number) => void
  onEdit: (subtaskId: number) => void
  onCreate: () => void
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

export function SubtaskList({
  subtasks,
  onToggleComplete,
  onDelete,
  onEdit,
  onCreate,
}: SubtaskListProps) {
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<number>>(new Set())

  const toggleExpanded = (subtaskId: number) => {
    setExpandedSubtasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(subtaskId)) {
        newSet.delete(subtaskId)
      } else {
        newSet.add(subtaskId)
      }
      return newSet
    })
  }

  const isOverdue = (subtask: Subtask) => {
    if (!subtask.deadline || subtask.is_completed) return false
    return new Date(subtask.deadline) < new Date()
  }

  if (subtasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No subtasks yet</p>
        <Button variant="ghost" size="sm" onClick={onCreate} className="mt-2">
          <Plus className="h-4 w-4 mr-2" />
          Add Subtask
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Subtasks</h3>
        <Button variant="ghost" size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <AnimatePresence mode="popLayout">
        {subtasks.map((subtask) => (
          <motion.div
            key={subtask.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Card
              className={cn(
                "p-3 hover:shadow-sm transition-shadow",
                subtask.is_completed && "opacity-60"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <Checkbox
                  checked={subtask.is_completed === 1}
                  onCheckedChange={() => onToggleComplete(subtask.id)}
                  className="mt-1"
                />

                {/* Subtask Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4
                        className={cn(
                          "text-sm font-medium cursor-pointer",
                          subtask.is_completed && "line-through text-muted-foreground"
                        )}
                        onClick={() => toggleExpanded(subtask.id)}
                      >
                        {subtask.name}
                      </h4>
                      {subtask.description && (
                        <p
                          className={cn(
                            "text-xs text-muted-foreground mt-1 line-clamp-2",
                            subtask.is_completed && "line-through"
                          )}
                        >
                          {subtask.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Priority Badge */}
                      <Badge
                        variant="outline"
                        className={cn("text-xs", priorityColors[subtask.priority])}
                      >
                        {priorityLabels[subtask.priority]}
                      </Badge>

                      {/* Overdue Badge */}
                      {isOverdue(subtask) && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="h-3 w-3" />
                        </Badge>
                      )}

                      {/* Actions */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleExpanded(subtask.id)}
                      >
                        {expandedSubtasks.has(subtask.id) ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onEdit(subtask.id)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => onDelete(subtask.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Subtask Details */}
                  <AnimatePresence>
                    {expandedSubtasks.has(subtask.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 space-y-2"
                      >
                        <Separator />
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {subtask.date && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(subtask.date), "MMM d, yyyy")}</span>
                            </div>
                          )}
                          {subtask.deadline && (
                            <div className={cn(
                              "flex items-center gap-2",
                              isOverdue(subtask) && "text-red-500"
                            )}>
                              <Clock className="h-3 w-3" />
                              <span>{format(new Date(subtask.deadline), "MMM d, yyyy HH:mm")}</span>
                            </div>
                          )}
                          {subtask.estimate_minutes > 0 && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Est: {subtask.estimate_minutes}m</span>
                            </div>
                          )}
                          {subtask.actual_minutes > 0 && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Check className="h-3 w-3" />
                              <span>Actual: {subtask.actual_minutes}m</span>
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
        ))}
      </AnimatePresence>
    </div>
  )
}
