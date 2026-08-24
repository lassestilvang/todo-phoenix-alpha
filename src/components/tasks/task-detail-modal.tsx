"use client";

import { useEffect, useState } from "react"
import {
  X, Clock, Calendar, Tag, AlertCircle, History,
  Paperclip, Timer, Play, Pause, Square, Upload, Trash2,
  ChevronDown, ChevronLeft, ChevronRight, Home
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { SubtaskList } from "./subtask-list"
import { useTimeTracker } from "@/lib/hooks/use-time-tracker"
import { startTimeEntry, stopTimeEntry, getActiveTimeEntry, addAttachmentToTask } from "@/app/actions/tasks"
import type { TaskWithDetails, Priority } from "@/lib/types"
import { format } from "date-fns"
import { useIsMobile } from "@/lib/hooks/use-is-mobile"

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
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState('subtasks')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const { isRunning, elapsedSeconds, startTimer, stopTimer, resetTimer, formatTime } = useTimeTracker(task.id)

  useEffect(() => {
    if (!open) return
    const checkActiveEntry = async () => {
      const activeEntry = await getActiveTimeEntry(task.id)
      if (activeEntry) {
        const startTime = new Date(activeEntry.started_at)
        const now = new Date()
        const initialElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000)
        // This would require updating the hook state - simplified for mobile version
      }
    }
    checkActiveEntry()
  }, [open, task.id])

  const isOverdue = !!(task.deadline && !task.is_completed && new Date(task.deadline) < new Date())

  const handleStartTimer = async () => {
    await startTimeEntry(task.id)
    startTimer()
  }

  const handleStopTimer = async () => {
    await stopTimeEntry(task.id)
    stopTimer()
  }

  const handleResetTimer = () => {
    resetTimer()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File size exceeds 10MB limit")
        return
      }
      setAttachedFile(file)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "p-0 shadow-lg",
          isMobile
            ? "max-w-sm rounded-b-none sm:max-w-md"
            : "max-w-3xl max-h-[90vh] overflow-hidden"
        )}
      >
        {isMobile ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
              <h2 className="font-semibold text-base sm:text-lg">{task.name}</h2>
              <div className="w-10" />
            </div>

            <ScrollArea className="flex-1">
              <MobileTaskContent
                task={task}
                isOverdue={isOverdue}
                priorityColors={priorityColors}
                priorityLabels={priorityLabels}
                activeTab={activeTab}
                onStartTimer={handleStartTimer}
                onStopTimer={handleStopTimer}
                attachedFile={attachedFile}
                handleFileUpload={handleFileUpload}
                isRunning={isRunning}
                elapsedSeconds={elapsedSeconds}
                formatTimeFunc={formatTime}
                isMobile={isMobile}
                onToggleSubtaskComplete={onToggleSubtaskComplete}
                onDeleteSubtask={onDeleteSubtask}
                onEditSubtask={onEditSubtask}
                onCreateSubtask={onCreateSubtask}
              />
            </ScrollArea>
          </div>
        ) : (
          <div className="flex flex-col h-full">
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
              <div className="p-6 space-y-6">
                <MobileTaskContent
                  task={task}
                  isOverdue={isOverdue}
                  priorityColors={priorityColors}
                  priorityLabels={priorityLabels}
                  activeTab={activeTab}
                  onStartTimer={handleStartTimer}
                  onStopTimer={handleStopTimer}
                  attachedFile={attachedFile}
                  handleFileUpload={handleFileUpload}
                  isRunning={isRunning}
                  elapsedSeconds={elapsedSeconds}
                  formatTimeFunc={formatTime}
                  isMobile={isMobile}
                  onToggleSubtaskComplete={onToggleSubtaskComplete}
                  onDeleteSubtask={onDeleteSubtask}
                  onEditSubtask={onEditSubtask}
                  onCreateSubtask={onCreateSubtask}
                />
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Mobile-optimized task content component
function MobileTaskContent({
  task,
  isOverdue,
  priorityColors,
  priorityLabels,
  activeTab,
  onStartTimer,
  onStopTimer,
  attachedFile,
  handleFileUpload,
  isRunning,
  elapsedSeconds,
  formatTimeFunc,
  isMobile,
  onToggleSubtaskComplete,
  onDeleteSubtask,
  onEditSubtask,
  onCreateSubtask,
}: {
  task: TaskWithDetails
  isOverdue: boolean
  priorityColors: Record<Priority, string>
  priorityLabels: Record<Priority, string>
  activeTab: string
  onStartTimer: () => void
  onStopTimer: () => void
  attachedFile: File | null
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  isRunning: boolean
  elapsedSeconds: number
  formatTimeFunc: (seconds: number) => string
  isMobile: boolean
  onToggleSubtaskComplete: (subtaskId: number) => void
  onDeleteSubtask: (subtaskId: number) => void
  onEditSubtask: (subtaskId: number) => void
  onCreateSubtask: () => void
}) {
  const [showTabs, setShowTabs] = useState(false)

  return (
    <div className="p-3 space-y-4">
      {/* Quick Actions Bar */}
      <Card className="p-3">
        <div className="flex items-center gap-3">
          {/* Timer Section */}
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Timer</p>
              <p className="font-mono font-medium">{formatTimeFunc(elapsedSeconds)}</p>
            </div>
          </div>

          <Separator orientation="vertical" className="hidden md:block" />

          {/* Time Info */}
          <div className="flex gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Est</p>
              <p className="font-medium">{task.estimate_minutes}m</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Actual</p>
              <p className="font-medium">{task.actual_minutes}m</p>
            </div>
          </div>

          <div className="ml-auto">
            {!isRunning ? (
              <Button size="sm" onClick={onStartTimer}>
                <Play className="h-3 w-3 mr-1" />
                Start
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onStopTimer}>
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Description */}
      {task.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{task.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Scheduling */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Schedule</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {task.date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>{format(new Date(task.date), "MMM d, yyyy")}</span>
            </div>
          )}
          {task.deadline && (
            <div className={cn("flex items-center gap-2 text-sm", isOverdue && "text-red-500")}>
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span>{format(new Date(task.deadline), "MMM d")}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Labels */}
      {task.labels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Labels</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* Tabs - Mobile Toggle */}
      {isMobile && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTabs(!showTabs)}
          className="w-full justify-between"
        >
          <span>Subtasks ({task.subtasks.length})</span>
          {showTabs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      )}

      {/* Subtasks Tab */}
      <div className={isMobile ? (showTabs ? "" : "hidden") : ""}>
        {task.subtasks.length > 0 ? (
          <SubtaskList
            subtasks={task.subtasks}
            onToggleComplete={onToggleSubtaskComplete}
            onDelete={onDeleteSubtask}
            onEdit={onEditSubtask}
            onCreate={onCreateSubtask}
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No subtasks yet</p>
          </div>
        )}
      </div>

      {/* Attachments */}
      {task.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {task.attachments.map((attachment) => {
                const getFileIcon = (fileType: string) => {
                  const iconMap: Record<string, string> = {
                    'image': '🖼️',
                    'document': '📄',
                    'spreadsheet': '📊',
                    'presentation': '📊',
                    'other': '📎',
                  };
                  return iconMap[fileType as keyof typeof iconMap] || iconMap.other;
                };

                const formatFileSize = (bytes?: number) => {
                  if (!bytes) return '';
                  const units = ['B', 'KB', 'MB', 'GB'];
                  let size = bytes;
                  let unitIndex = 0;
                  while (size >= 1024 && unitIndex < units.length - 1) {
                    size /= 1024;
                    unitIndex++;
                  }
                  return `${size.toFixed(1)} ${units[unitIndex]}`;
                };

                return (
                  <div key={attachment.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-lg flex-shrink-0">{getFileIcon(attachment.file_type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{attachment.filename}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.file_data.length)} • {new Date(attachment.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a');
                          const fileData = attachment.file_data;
                          if (fileData && fileData.startsWith('data:')) {
                            const byteString = atob(fileData.split(',')[1]);
                            const mimeType = fileData.split(',')[0].split(':')[1].split(';')[0];
                            const arrayBuffer = new ArrayBuffer(byteString.length);
                            const uint8Array = new Uint8Array(arrayBuffer);
                            for (let i = 0; i < byteString.length; i++) {
                              uint8Array[i] = byteString.charCodeAt(i);
                            }
                            const blob = new Blob([uint8Array], { type: mimeType });
                            link.href = URL.createObjectURL(blob);
                            link.download = attachment.filename;
                            link.click();
                            URL.revokeObjectURL(link.href);
                          } else {
                            // Handle case where file_data might not be Base64
                            alert('File preview not available in current format');
                          }
                        }}
                      >
                        Download
                      </Button>
                      {attachment.file_type === 'image' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Show image preview in a modal or overlay
                            const imageUrl = attachment.file_data && attachment.file_data.startsWith('data:image/')
                              ? attachment.file_data
                              : undefined;
                            if (imageUrl) {
                              const newWindow = window.open();
                              if (newWindow) {
                                const img = document.createElement('img');
                                img.src = imageUrl;
                                img.style.maxWidth = '100%';
                                img.style.maxHeight = '100vh';
                                img.style.objectFit = 'contain';
                                newWindow.document.body.appendChild(img);
                                newWindow.document.body.style.margin = '0';
                                newWindow.document.body.style.display = 'flex';
                                newWindow.document.body.style.alignItems = 'center';
                                newWindow.document.body.style.justifyContent = 'center';
                                newWindow.document.body.style.backgroundColor = 'rgba(0,0,0,0.9)';
                                newWindow.document.title = attachment.filename;
                              }
                            }
                          }}
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mobile File Upload */}
      {isMobile && task.attachments.length < 10 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="file"
              className="w-full"
              onChange={handleFileUpload}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Max 10 attachments per task, files under 10MB
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
