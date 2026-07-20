"use client"

import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar, Clock, Tag, AlertCircle, Save, Repeat,
  Paperclip as IconPaperclip, X as IconX
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label as UILabel } from "@/components/ui/label"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { format } from "date-fns"
import type { TaskFormData, Priority, RecurringPattern, List, Label } from "@/lib/types"

const taskSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  description: z.string().optional(),
  date: z.date().optional(),
  deadline: z.date().optional(),
  estimate_minutes: z.number().min(0).optional(),
  priority: z.enum(["high", "medium", "low", "none"]).optional(),
  is_recurring: z.boolean().optional(),
  recurring_pattern: z.enum([
    "every_day",
    "every_week",
    "every_weekday",
    "every_month",
    "every_year",
    "custom_n_days",
    "custom_n_weeks",
    "custom_days_of_month"
  ]).optional(),
  recurring_custom_value: z.string().optional(),
  reminder_minutes: z.number().optional(),
  reminder_time: z.string().optional(),
  list_id: z.number().min(1, "Please select a list"),
  label_ids: z.array(z.number()).optional(),
  attachments: z.array(z.string()).optional(),
})

interface TaskFormDialogProps {
  open: boolean
  onClose: () => void
  onSave: (data: TaskFormData) => void
  task?: TaskFormData
  lists: List[]
  labels: Label[]
  mode: "create" | "edit"
}

export function TaskFormDialog({
  open,
  onClose,
  onSave,
  task,
  lists,
  labels,
  mode,
}: TaskFormDialogProps) {
  const [selectedLabels, setSelectedLabels] = useState<number[]>(task?.label_ids || [])
  const [showRecurringOptions, setShowRecurringOptions] = useState(false)
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>(task?.attachments || [])
  const [showReminderOptions, setShowReminderOptions] = useState(false)

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: task || {
      name: "",
      description: "",
      priority: "none",
      estimate_minutes: 0,
      is_recurring: false,
      label_ids: [],
      list_id: lists.length > 0 ? lists[0].id : 1, // Default to first list or ID 1
    },
  })

  useEffect(() => {
    if (task) {
      form.reset(task)
      setSelectedLabels(task.label_ids || [])
      setShowRecurringOptions(task.is_recurring || false)
    } else {
      // Update default list_id when lists change
      if (lists.length > 0) {
        form.setValue("list_id", lists[0].id)
      }
    }
  }, [task, form, lists])

  const handleSubmit = (data: TaskFormData) => {
    onSave({ ...data, label_ids: selectedLabels })
    onClose()
    form.reset()
    setSelectedLabels([])
    setShowRecurringOptions(false)
  }

  const toggleLabel = (labelId: number) => {
    setSelectedLabels(prev => 
      prev.includes(labelId) 
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    )
  }

  const handleEstimateChange = (value: number[]) => {
    form.setValue("estimate_minutes", value[0])
  }

  // eslint-disable-next-line react-hooks/incompatible-library
  const estimateMinutes = form.watch("estimate_minutes") || 0
  const hours = Math.floor(estimateMinutes / 60)
  const minutes = estimateMinutes % 60

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create New Task" : "Edit Task"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <UILabel htmlFor="name">Task Name *</UILabel>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="Enter task name"
                className="mt-1"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <UILabel htmlFor="description">Description</UILabel>
              <Textarea
                id="description"
                {...form.register("description")}
                placeholder="Add a description..."
                className="mt-1 min-h-[100px]"
              />
            </div>
          </div>

          <Separator />

          {/* Scheduling */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduling
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <UILabel>Date</UILabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1",
                        !form.watch("date") && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {form.watch("date") ? format(form.watch("date")!, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={form.watch("date") || undefined}
                      onSelect={(date) => form.setValue("date", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <UILabel>Deadline</UILabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1",
                        !form.watch("deadline") && "text-muted-foreground"
                      )}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {form.watch("deadline") ? (
                        format(form.watch("deadline")!, "PPP HH:mm")
                      ) : (
                        <span>Pick a deadline</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={form.watch("deadline") || undefined}
                      onSelect={(date) => form.setValue("deadline", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <Separator />

          {/* Priority & Time */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Priority & Time
            </h3>

            <div>
              <UILabel>Priority</UILabel>
              <Controller
                name="priority"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value: Priority) => field.onChange(value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div>
              <UILabel>Time Estimate</UILabel>
              <div className="mt-2 space-y-2">
                <Slider
                  value={[estimateMinutes]}
                  onValueChange={handleEstimateChange}
                  max={480}
                  step={15}
                  className="w-full"
                />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>0m</span>
                  <span className="font-medium">
                    {hours > 0 && `${hours}h `}{minutes}m
                  </span>
                  <span>8h</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Recurring */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Recurring Task
              </h3>
              <Checkbox
                checked={showRecurringOptions}
                onCheckedChange={(checked) => {
                  setShowRecurringOptions(checked as boolean)
                  form.setValue("is_recurring", checked as boolean)
                }}
              />
            </div>

            <AnimatePresence>
              {showRecurringOptions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-3"
                >
                  <div>
                    <UILabel>Pattern</UILabel>
                    <Controller
                      name="recurring_pattern"
                      control={form.control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={(value: RecurringPattern) => 
                            field.onChange(value)
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="every_day">Every Day</SelectItem>
                            <SelectItem value="every_week">Every Week</SelectItem>
                            <SelectItem value="every_weekday">Every Weekday</SelectItem>
                            <SelectItem value="every_month">Every Month</SelectItem>
                            <SelectItem value="every_year">Every Year</SelectItem>
                            <SelectItem value="custom_n_days">Custom: Every N Days</SelectItem>
                            <SelectItem value="custom_n_weeks">Custom: Every N Weeks</SelectItem>
                            <SelectItem value="custom_days_of_month">Custom: Days of Month</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {form.watch("recurring_pattern")?.includes("custom") && (
                    <div>
                      <UILabel>Custom Value</UILabel>
                      <Input
                        {...form.register("recurring_custom_value")}
                        placeholder="e.g., 2 for every 2 days"
                        className="mt-1"
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Separator />

          {/* Labels */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Labels
            </h3>

            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <Badge
                  key={label.id}
                  variant={selectedLabels.includes(label.id) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer",
                    selectedLabels.includes(label.id) && "border-primary"
                  )}
                  style={{
                    backgroundColor: selectedLabels.includes(label.id)
                      ? label.color
                      : "transparent",
                    color: selectedLabels.includes(label.id) ? "white" : undefined,
                  }}
                  onClick={() => toggleLabel(label.id)}
                >
                  {label.emoji} {label.name}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Reminders */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Reminders
            </h3>

            <div className="space-y-2">
              <Checkbox
                checked={showReminderOptions}
                onCheckedChange={(checked) => {
                  setShowReminderOptions(checked as boolean)
                  // If turning off, clear reminder
                  if (!checked) {
                    form.setValue("reminder_minutes", undefined)
                    form.setValue("reminder_time", undefined)
                  }
                }}
              />

              {showReminderOptions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-2"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <UILabel>Remind me (minutes before)</UILabel>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g., 10, 30, 60"
                        {...form.register("reminder_minutes", {
                          validate: (value) =>
                            value === undefined ||
                            (value >= 0 && value <= 1440) ||
                            "Please enter a valid number (0-1440)"
                        })}
                        className="mt-1"
                      />
                      {form.formState.errors.reminder_minutes && (
                        <p className="text-sm text-destructive mt-1">
                          {form.formState.errors.reminder_minutes.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <UILabel>Or specific time</UILabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal mt-1",
                              !form.watch("reminder_time") && "text-muted-foreground"
                            )}
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            {form.watch("reminder_time") ? (
                              <span>{form.watch("reminder_time")}</span>
                            ) : (
                              <span>Pick time</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between px-4 py-2">
                              <span>Hour</span>
                              <span>Minute</span>
                            </div>
                            <div className="border-t">
                              <div className="grid grid-cols-2 gap-0">
                                {[...Array(24)].map((_, hour) => (
                                  <div key={hour} className="border border-t-0 border-l-0 py-2">
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className={cn(
                                        form.watch("reminder_time") === `${hour.toString().padStart(2, '0')}:00`
                                          ? "bg-primary text-primary-foreground"
                                          : ""
                                      )}
                                      onClick={() =>
                                        form.setValue("reminder_time", `${hour.toString().padStart(2, '0')}:00`)
                                      }
                                    >
                                      {hour.toString().padStart(2, '0')}
                                    </Button>
                                  </div>
                                ))}
                                {[...Array(60)].map((_, minute) => (
                                  <div key={minute} className="border border-t-0 border-l-0 py-2">
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className={cn(
                                        form.watch("reminder_time")?.endsWith(`${minute.toString().padStart(2, '0')}`)
                                          ? "bg-primary text-primary-foreground"
                                          : ""
                                      )}
                                      onClick={() => {
                                        const hour = form.watch("reminder_time")?.split(':')[0] || '00'
                                        form.setValue("reminder_time", `${hour.padStart(2, '0')}:${minute.toString().padStart(2, '0')}`)
                                      }}
                                    >
                                      {minute.toString().padStart(2, '0')}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          <Separator />

          {/* Attachments */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <IconPaperclip className="h-4 w-4" />
              Attachments
            </h3>

            <div className="space-y-3">
              <div className="flex items-center">
                <UILabel>Attach files</UILabel>
                <Button variant="outline" size="sm" onClick={() => {
                  // Trigger file input click
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.multiple = true
                  input.onchange = (e: any) => {
                    if (e.target && (e.target as HTMLInputElement).files) {
                      const files = Array.from((e.target as HTMLInputElement).files || [])
                      if (files.length > 0) {
                        const fileNames = files.map(f => f.name)
                        setSelectedAttachments(prev => [...prev, ...fileNames])
                        // Note: Actual file upload would happen separately
                        // For now we just store filenames
                      }
                    }
                  }
                  input.click()
                }}>
                  Upload Files
                </Button>
              </div>

              {selectedAttachments.length > 0 && (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-2">
                    {selectedAttachments.map((filename, index) => (
                      <Badge
                        key={`${filename}-${index}`}
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        <IconPaperclip className="h-3 w-3 mr-1" />
                        <span className="text-xs">{filename}</span>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setSelectedAttachments(prev => prev.filter((_, i) => i !== index))
                          }}
                        >
                          <IconX className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Note: File upload implementation requires backend integration
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* List */}
          <div className="space-y-4">
            <UILabel>List</UILabel>
            <Controller
              name="list_id"
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value?.toString()}
                  onValueChange={(value) => field.onChange(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map((list) => (
                      <SelectItem key={list.id} value={list.id.toString()}>
                        {list.emoji} {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              {mode === "create" ? "Create Task" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
