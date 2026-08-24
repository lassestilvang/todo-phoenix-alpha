"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Calendar, Clock, CheckSquare, Folder, Settings, AlertCircle,
  X as IconX, Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { TaskDecomposition, TaskSubtask } from "@/lib/nlp/task-parser"
import { TaskDecomposer } from "@/lib/nlp/task-parser"

// Extended type for UI display
interface DisplaySubtask extends TaskSubtask {
  is_completed?: boolean
}

interface TaskDecompositionProps {
  open: boolean
  onClose: () => void
  taskId?: number
  originalTaskText?: string
  onApply: (subtasks: DisplaySubtask[]) => void
}

export function TaskDecomposition({
  open,
  onClose,
  taskId,
  originalTaskText,
  onApply,
}: TaskDecompositionProps) {
  const [isDecomposing, setIsDecomposing] = useState(false)
  const [subtasks, setSubtasks] = useState<DisplaySubtask[]>([])
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)

  const originalText = originalTaskText || ""

  // Trigger decomposition
  const triggerDecomposition = () => {
    if (!originalText.trim()) {
      toast.error("Please enter a task description first")
      return
    }

    setIsDecomposing(true)

    // Use the existing TaskDecomposer
    const startTime = performance.now()
    const decomposition: TaskDecomposition = TaskDecomposer.decompose(originalText)
    const endTime = performance.now()

    // Convert TaskSubtask to DisplaySubtask (adding is_completed property)
    const displaySubtasks: DisplaySubtask[] = decomposition.subtasks.map(subtask => ({
      ...subtask,
      is_completed: false, // Initialize as not completed
    }))
    setSubtasks(displaySubtasks)
    setIsDecomposing(false)
    setShowSmartSuggestions(true)

    toast.success(
      `Task decomposed into ${decomposition.subtasks.length} subtask(s) in ${((endTime - startTime) / 1000).toFixed(1)}s`
    )
  }

  // Format time estimate for display
  const formatEstimate = (minutes?: number) => {
    if (!minutes) return "0m"
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  if (!open) return null

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, translateY: 20 }}
        animate={{ scale: 1, opacity: 1, translateY: 0 }}
        exit={{ scale: 0.95, opacity: 0, translateY: 20 }}
        className="bg-popover rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            <Folder className="h-4 w-4 mr-2" />
            Task Decomposition
          </h3>

          {/* Original task info */}
          {originalText.trim() && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="mb-4 p-3 rounded bg-muted/50"
            >
              <p className="text-sm text-muted-foreground font-medium">
                Original task: <span className="font-mono break-all">{originalText}</span>
              </p>
            </motion.div>
          )}

          {/* Smart suggestions */}
          {showSmartSuggestions && !isDecomposing && (
            <motion.div
              key="suggestions"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <p className="text-sm text-muted-foreground mb-3">
                Smart suggestions for breaking down your task:
              </p>

              <div className="space-y-3 max-h-40 overflow-y-auto">
                {generateSmartSuggestions(originalText).map((suggestion: string, i: number) => (
                  <div key={i} className="p-2 rounded bg-primary/5">
                    <span className="text-xs text-primary">{suggestion}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* AI Generation */}
          {isGeneratingAI && (
            <motion.div key="ai-generation" className="mb-4 p-4 rounded bg-muted">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span className="text-sm">Generating AI-powered suggestions...</span>
            </motion.div>
          )}

          {/* Decomposition results */}
          {!isGeneratingAI && subtasks.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">
                Decomposition complete - {subtasks.length} subtask(s) generated
              </p>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {subtasks.map((subtask, i) => (
                  <div
                    key={i}
                    className="p-3 rounded bg-muted/50 flex items-start gap-3"
                  >
                    {/* Phase badge */}
                    <Badge
                      variant={getPhaseVariant(subtask.phase || 'execution')}
                      className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                    >
                      {getPhaseLabel(subtask.phase || 'execution')}
                    </Badge>

                    {/* Subtask info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {subtask.name}
                      </p>
                      {subtask.estimate_minutes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatEstimate(subtask.estimate_minutes)} estimated
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSubtasks(prev =>
                            prev.map((s, idx) =>
                              idx === i
                                ? { ...s, is_completed: !s.is_completed }
                                : s
                            )
                          )
                        }}
                      >
                        <CheckSquare className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSubtasks(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <IconX className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No decomposition yet */}
          {isDecomposing && (
            <motion.div key="loading" className="p-4 rounded bg-muted text-center">
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              <p className="text-sm mt-2">Analyzing task...</p>
            </motion.div>
          )}

          {subtasks.length === 0 && !isDecomposing && !isGeneratingAI && (
            <motion.div key="empty" className="p-8 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">
                No decomposition yet. Enter a task above and click "Decompose Task"
              </p>
            </motion.div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isDecomposing || isGeneratingAI}
            >
              Cancel
            </Button>
            <Button
              onClick={() => onApply(subtasks)}
              disabled={isDecomposing || isGeneratingAI || subtasks.length === 0}
              className="flex items-center gap-2"
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              {subtasks.length > 0 && (
                <>
                  Apply ({subtasks.length} subtasks)
                </>
              )}
              {subtasks.length === 0 && "Decompose Task"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Helper functions
function getPhaseVariant(phase: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    planning: 'destructive',
    execution: 'secondary',
    review: 'destructive',
    delivery: 'outline',
  }
  return variants[phase] || 'default'
}

function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    planning: '📋 Planning',
    execution: '⚡ Execution',
    review: '👀 Review',
    delivery: '🚀 Delivery',
  }
  return labels[phase] || 'Task'
}

function generateSmartSuggestions(text: string): string[] {
  const { suggestions, recommendedPhases, estimatedComplexity } =
    TaskDecomposer.smartSuggestions(text)

  const phaseTags: Record<'low' | 'medium' | 'high', string> = {
    low: '🟢 Low',
    medium: '🟡 Medium',
    high: '🔴 High',
  }

  const result: string[] = []

  // Add complexity indicator
  if (suggestions.length > 0) {
    result.push(
      `Task complexity: ${phaseTags[estimatedComplexity] || 'Medium'}`
    )
  }

  // Add phase recommendations
  if (recommendedPhases.length > 0) {
    result.push(`Recommended phases: ${recommendedPhases.join(' → ')}`)
  }

  // Add specific suggestions
  suggestions.forEach(suggestion => result.push(suggestion))

  return result
}