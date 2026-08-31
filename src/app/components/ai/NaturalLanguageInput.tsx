"use client"

import { useState } from "react"
import { toast } from "sonner"
import { nlpTaskParser } from "@/lib/ai/nlp-task-parser"
import { Send, Sparkles } from "lucide-react"

interface NaturalLanguageInputProps {
  onTaskCreated: (task: any) => void
  listId?: number
}

export function NaturalLanguageInput({ onTaskCreated, listId = 1 }: NaturalLanguageInputProps) {
  const [input, setInput] = useState("")
  const [isParsing, setIsParsing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    setIsParsing(true)

    try {
      // Parse the natural language input
      const parsed = await nlpTaskParser.parse(input)

      if (parsed.tasks.length === 0) {
        toast.error("Could not parse task", {
          description: "Please try a different format, e.g., 'Buy groceries tomorrow at 5pm'"
        })
        return
      }

      // Create the task from parsed data
      const firstTask = parsed.tasks[0]

      const taskData = {
        name: firstTask.name,
        description: firstTask.description || input,
        list_id: listId,
        priority: firstTask.priority,
        estimate_minutes: firstTask.estimateMinutes,
        date: firstTask.dueDate,
        deadline: firstTask.deadline,
        is_recurring: firstTask.isRecurring,
        recurring_pattern: firstTask.recurringPattern,
      }

      if (onTaskCreated) {
        onTaskCreated(taskData)
      }

      toast.success("Task created", {
          description: parsed.warnings.length > 0 ? parsed.warnings.join(". ") : undefined
        })

      setInput("")
    } catch (error) {
      console.error("NLP parsing failed:", error)
      toast.error("Failed to parse task description")
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='E.g., "Buy groceries tomorrow at 5pm #errands ~30min"'
          className="flex-1 px-3 py-2 border rounded"
          disabled={isParsing}
        />
        <button
          type="submit"
          disabled={isParsing || !input.trim()}
          className="bg-primary text-primary-foreground px-4 py-2 rounded"
        >
          {isParsing ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      <div className="text-xs text-muted-foreground">
        Tip: Try "Call client Monday 2pm #business ~1hr" or "Review PRs #work"
      </div>
    </form>
  )
}