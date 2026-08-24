"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar, Clock, ChevronDown, ChevronUp,
  Check, X, RefreshCw, Calendar as CalendarIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { toast } from "sonner"
import type { RecurringPattern } from "@/lib/types"

interface RecurringTaskWizardProps {
  open: boolean
  onClose: () => void
  onApply: (config: RecurringTaskConfig) => void
  initialPattern?: RecurringPattern | null
}

export interface RecurringTaskConfig {
  pattern: 'every_day' | 'every_week' | 'every_weekday' | 'every_month' | 'every_year' | 'custom_n_days' | 'custom_n_weeks' | 'custom_days_of_month'
  interval?: number
  startDate: Date
  endDate?: Date | null
  excludeDates: string[]
  showOccurrences: boolean
}

export function RecurringTaskWizard({
  open,
  onClose,
  onApply,
  initialPattern
}: RecurringTaskWizardProps) {
  const [activeStep, setActiveStep] = useState(0)
  const [pattern, setPattern] = useState<RecurringTaskConfig>({
    pattern: 'every_day',
    startDate: new Date(),
    excludeDates: [],
    showOccurrences: true
  })

  const patternOptions = [
    { value: 'every_day', label: 'Every day', description: 'Complete this task daily' },
    { value: 'every_weekday', label: 'Every weekday', description: 'Monday through Friday' },
    { value: 'every_week', label: 'Every week', description: 'On a specific day each week' },
    { value: 'every_month', label: 'Every month', description: 'On a specific date each month' },
    { value: 'every_year', label: 'Every year', description: 'On the same date each year' },
    { value: 'custom_n_days', label: 'Custom: Every N days', description: 'Specify how many days between each occurrence' },
    { value: 'custom_n_weeks', label: 'Custom: Every N weeks', description: 'Specify how many weeks between each occurrence' },
    { value: 'custom_days_of_month', label: 'Custom: Days of month', description: 'Specific days like 1st, 15th' },
  ]

  const generateOccurrences = (): Date[] => {
    const dates: Date[] = []
    let current = new Date(pattern.startDate)
    current.setHours(0, 0, 0, 0)

    const count = pattern.showOccurrences ? 10 : 0

    for (let i = 0; i < count; i++) {
      dates.push(new Date(current))

      switch (pattern.pattern) {
        case 'every_day':
          current.setDate(current.getDate() + (pattern.interval || 1))
          break
        case 'every_weekday':
          do {
            current.setDate(current.getDate() + 1)
          } while (current.getDay() === 0 || current.getDay() === 6) // Skip weekends
          break
        case 'every_week':
          current.setDate(current.getDate() + (pattern.interval || 1) * 7)
          break
        case 'every_month':
          current.setMonth(current.getMonth() + (pattern.interval || 1))
          break
        case 'every_year':
          current.setFullYear(current.getFullYear() + (pattern.interval || 1))
          break
        case 'custom_n_days':
          current.setDate(current.getDate() + (pattern.interval || 1))
          break
        case 'custom_n_weeks':
          current.setDate(current.getDate() + (pattern.interval || 1) * 7)
          break
        case 'custom_days_of_month':
          // This would need special handling
          current.setDate(current.getDate() + 1)
          break
      }
    }

    return dates.filter(d => {
      const dateStr = d.toISOString().split('T')[0]
      return !pattern.excludeDates.includes(dateStr)
    })
  }

  const handleApply = () => {
    onApply(pattern)
    onClose()
    setActiveStep(0)
  }

  const handleCancel = () => {
    onClose()
    setActiveStep(0)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-popover rounded-lg shadow-lg w-full max-w-md mx-4"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recurring Task Options</h3>

          <div className="space-y-4">
            {/* Step 1: Pattern Selection */}
            {activeStep === 0 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    How often should this task repeat?
                  </p>

                  <div className="grid gap-2">
                    {patternOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setPattern(prev => ({
                            ...prev,
                            pattern: option.value as RecurringPattern
                          }))
                          setActiveStep(1)
                        }}
                        className="text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Configuration */}
            {activeStep === 1 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Start Date</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {pattern.startDate.toLocaleDateString()}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={pattern.startDate}
                          onSelect={(date) => date && setPattern(prev => ({
                            ...prev,
                            startDate: date
                          }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {['custom_n_days', 'custom_n_weeks', 'custom_days_of_month'].includes(pattern.pattern) && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        {pattern.pattern === 'custom_n_days' ? 'Every N Days' :
                         pattern.pattern === 'custom_n_weeks' ? 'Every N Weeks' :
                         'Days of Month'}
                      </p>
                      {pattern.pattern === 'custom_days_of_month' ? (
                        <Input
                          placeholder="e.g., 1, 15 for 1st and 15th"
                          value={pattern.interval?.toString() || ''}
                          onChange={(e) => setPattern(prev => ({
                            ...prev,
                            interval: parseInt(e.target.value.replace(/\D/g, ''))
                          }))}
                        />
                      ) : (
                        <Input
                          type="number"
                          min={1}
                          value={pattern.interval || 1}
                          onChange={(e) => setPattern(prev => ({
                            ...prev,
                            interval: parseInt(e.target.value)
                          }))}
                        />
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium mb-2">End Date (optional)</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left"
                        >
                          <Clock className="mr-2 h-4 w-4" />
                          {pattern.endDate ? pattern.endDate.toLocaleDateString() : 'No end date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={pattern.endDate || undefined}
                          onSelect={(date) => date && setPattern(prev => ({
                            ...prev,
                            endDate: date
                          }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const day = new Date().getDay()
                      setPattern(prev => ({ ...prev, dayOfWeek: day }))
                    }}
                    className="w-full"
                  >
                    Add specific day
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Preview */}
            {activeStep === 2 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="space-y-3">
                  <p className="text-sm font-medium mb-2">Upcoming Occurrences</p>
                  <div className="max-h-60 overflow-y-auto border rounded">
                    {generateOccurrences().map((date, i) => (
                      <div key={i} className="p-2 text-sm border-b last:border-b-0">
                        {date.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Advanced */}
            {activeStep === 3 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="space-y-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pattern.showOccurrences}
                      onChange={(e) => setPattern(prev => ({
                        ...prev,
                        showOccurrences: e.target.checked
                      }))}
                    />
                    <span className="text-sm">Show occurrences preview</span>
                  </label>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newExcludes = [...pattern.excludeDates]
                      const today = new Date().toISOString().split('T')[0]
                      if (!newExcludes.includes(today)) {
                        newExcludes.push(today)
                      }
                      setPattern(prev => ({
                        ...prev,
                        excludeDates: newExcludes
                      }))
                    }}
                  >
                    Exclude today
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-6">
            <div className="flex gap-2">
              {activeStep > 0 && (
                <Button variant="outline" size="sm" onClick={() => setActiveStep(prev => prev - 1)}>
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {activeStep < 3 && (
                <Button size="sm" onClick={() => setActiveStep(prev => prev + 1)}>
                  Continue
                </Button>
              )}
              {activeStep === 3 && (
                <Button onClick={handleApply}>
                  Apply
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}