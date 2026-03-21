"use client"

import { useEffect } from "react"
import { 
  X, Clock, Calendar, Tag, AlertCircle, History, 
  Paperclip, Timer, Play, Pause, Square
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SubtaskList } from "./subtask-list"
import { useTimeTracker } from "@/lib/hooks/use-time-tracker"
import { startTimeEntry, stopTimeEntry, getActiveTimeEntry } from "@/app/actions/tasks"
import type { TaskWithDetails, Priority } from "@/lib/types"
import { format } from "date-fns"

interface TaskDetailModalProps {
  open: boolean
  onClose: () => void
  task: TaskWithDetails
  onToggleSubtaskComplete: (subtaskId: number) => void
  onDeleteSubtask: (subtaskId: number) => void
  onEditSubtask: (subtaskId: number) => void
  onCreateSubtask: () => void
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

export function TaskDetailModal({
  open,
  onClose,
  task,
  onToggleSubtaskComplete,
  onDeleteSubtask,
  onEditSubtask,
  onCreateSubtask,
}: TaskDetailModalProps) {
  const { isRunning, elapsedSeconds, startTimer, stopTimer, resetTimer, formatTime } = useTimeTracker(task.id)

  useEffect(() => {
    // Check if there's an active time entry
    const checkActiveEntry = async () => {
      const activeEntry = await getActiveTimeEntry(task.id)
      if (activeEntry) {
        const startedAt = new Date(activeEntry.started_at)
        const now = new Date()
        const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000)
        // Start the timer with the elapsed time
        startTimer()
      }
    }
    
    if (open) {
      checkActiveEntry()
    }
    
    return () => {
      // Cleanup if needed
    }
  }, [open, task.id, startTimer])

  const isOverdue = task.deadline && !task.is_completed && new Date(task.deadline) < new Date()

  const handleStartTimer = async () => {
    await startTimeEntry(task.id)
    startTimer()
  }

  const handleStopTimer = async () => {
    const durationMinutes = Math.floor(elapsedSeconds / 60)
    // Get the active entry and stop it
    const activeEntry = await getActiveTimeEntry(task.id)
    if (activeEntry) {
      await stopTimeEntry(activeEntry.id, new Date(), durationMinutes)
    }
    stopTimer()
  }

  const handleResetTimer = () => {
    resetTimer()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl">{task.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant="outline"
                  className={priorityColors[task.priority]}
                >
                  {priorityLabels[task.priority]}
                </Badge>
                {task.list && (
                  <Badge variant="outline">
                    {task.list.emoji} {task.list.name}
                  </Badge>
                )}
                {isOverdue && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Overdue
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6">
            {/* Description */}
            {task.description && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{task.description}</p>
              </div>
            )}

            {/* Scheduling */}
            <div className="grid grid-cols-2 gap-4">
              {task.date && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="font-medium">{format(new Date(task.date), "PPP")}</p>
                    </div>
                  </div>
                </Card>
              )}
              {task.deadline && (
                <Card className={cn("p-4", isOverdue && "border-red-500")}>
                  <div className={cn("flex items-center gap-2 text-sm", isOverdue && "text-red-500")}>
                    <Clock className="h-4 w-4" />
                    <div>
                      <p className="text-xs text-muted-foreground">Deadline</p>
                      <p className="font-medium">{format(new Date(task.deadline), "PPP p")}</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Time Tracking */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Timer</p>
                      <p className="font-mono text-lg font-medium">{formatTime(elapsedSeconds)}</p>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated</p>
                    <p className="font-medium">{task.estimate_minutes}m</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Actual</p>
                    <p className="font-medium">{task.actual_minutes}m</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isRunning ? (
                    <Button size="sm" onClick={handleStartTimer}>
                      <Play className="h-4 w-4 mr-2" />
                      Start
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handleStopTimer}>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={handleResetTimer}>
                    <Square className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Labels */}
            {task.labels.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Labels
                </h3>
                <div className="flex flex-wrap gap-2">
                  {task.labels.map((label) => (
                    <Badge
                      key={label.id}
                      variant="outline"
                      style={{
                        backgroundColor: label.color,
                        color: "white",
                        borderColor: label.color,
                      }}
                    >
                      {label.emoji} {label.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Recurring Info */}
            {task.is_recurring && task.recurring_pattern && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Recurring</p>
                    <p className="font-medium capitalize">
                      {task.recurring_pattern.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Attachments */}
            {task.attachments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments
                </h3>
                <div className="space-y-2">
                  {task.attachments.map((attachment) => (
                    <Card key={attachment.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{attachment.filename}</span>
                        </div>
                        <Button variant="ghost" size="sm">
                          Download
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Tabs for Subtasks and History */}
            <Tabs defaultValue="subtasks">
              <TabsList>
                <TabsTrigger value="subtasks">
                  Subtasks ({task.subtasks.length})
                </TabsTrigger>
                <TabsTrigger value="history">
                  History ({task.changes.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="subtasks" className="mt-4">
                <SubtaskList
                  subtasks={task.subtasks}
                  onToggleComplete={onToggleSubtaskComplete}
                  onDelete={onDeleteSubtask}
                  onEdit={onEditSubtask}
                  onCreate={onCreateSubtask}
                />
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {task.changes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No changes recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {task.changes.map((change) => (
                      <Card key={change.id} className="p-3">
                        <div className="flex items-start gap-3">
                          <History className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium capitalize">
                                {change.field_name.replace(/_/g, " ")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(change.changed_at), "PPp")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs">
                              <span className="text-muted-foreground line-through">
                                {change.old_value || "—"}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-medium">
                                {change.new_value || "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
