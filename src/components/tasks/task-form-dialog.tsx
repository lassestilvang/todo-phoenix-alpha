"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Calendar, Clock, Tag, AlertCircle, Save, Repeat
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
  list_id: z.number().min(1, "Please select a list"),
  label_ids: z.array(z.number()).optional(),
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
      if (lists.length > 0 && !form.getValues("list_id")) {
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
              <Select
                value={form.watch("priority")}
                onValueChange={(value: Priority) => form.setValue("priority", value)}
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
                    <Select
                      value={form.watch("recurring_pattern")}
                      onValueChange={(value: RecurringPattern) => 
                        form.setValue("recurring_pattern", value)
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

          {/* List */}
          <div className="space-y-4">
            <UILabel>List</UILabel>
            <Select
              value={form.watch("list_id")?.toString()}
              onValueChange={(value) => form.setValue("list_id", parseInt(value))}
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
