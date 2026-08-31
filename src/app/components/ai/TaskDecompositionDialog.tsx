"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { taskFormAI } from "@/lib/ai/task-form-integration"
import { Loader2, Brain } from "lucide-react"

interface TaskDecompositionDialogProps {
  children: React.ReactNode
  onComplete?: (decomposition: any) => void
}

export function TaskDecompositionDialog({ children, onComplete }: TaskDecompositionDialogProps) {
  const [open, setOpen] = useState(false)
  const [taskName, setTaskName] = useState("")
  const [description, setDescription] = useState("")
  const [isDecomposing, setIsDecomposing] = useState(false)
  const [decomposition, setDecomposition] = useState<any>(null)

  const handleDecompose = async () => {
    if (!taskName.trim()) {
      toast.error("Please enter a task name")
      return
    }

    setIsDecomposing(true)
    setDecomposition(null)

    try {
      const result = await taskFormAI.decomposeTask(
        taskName,
        description,
        {
          userGoals: [],
          energyLevel: "medium",
          preferredSize: "medium"
        }
      )

      setDecomposition(result)

      toast.success("Task decomposed successfully")

      if (onComplete) {
        onComplete(result)
      }
    } catch (error) {
      console.error("Decomposition failed:", error)
      toast.error("Failed to decompose task")
    } finally {
      setIsDecomposing(false)
    }
  }

  return (
    <>
      {children}
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Brain className="mr-2 h-4 w-4" />
          Decompose Task
        </Button>
      </DialogTrigger>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon">
            <Brain className="mr-2 h-4 w-4" />
            Decompose Task
          </Button>
        </DialogTrigger>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Decompose Task</DialogTitle>
            <DialogDescription>
              Break down a complex task into manageable subtasks using AI
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="taskName">Task Name *</Label>
              <input
                id="taskName"
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="Enter the complex task to decompose"
                className="w-full px-3 py-2 border rounded"
                disabled={isDecomposing}
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide more context about the task"
                className="w-full"
                rows={4}
                disabled={isDecomposing}
              />
            </div>

            {isDecomposing && (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Decomposing task...</span>
              </div>
            )}

            {decomposition && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Decomposition Result</h3>
                <div className="space-y-2">
                  <div>
                    <strong>Parent Task:</strong> {decomposition.parentTask.name}
                  </div>
                  <div>
                    <strong>Subtasks ({decomposition.subtasks.length}):</strong>
                  </div>
                  {decomposition.subtasks.map((subtask: any, index: number) => (
                    <div key={subtask.id} className="ml-4">
                      {index + 1}. {subtask.name} ({subtask.estimatedMinutes} min)
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isDecomposing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDecompose}
                disabled={isDecomposing || !taskName.trim()}
                className="bg-primary text-primary-foreground"
              >
                {isDecomposing ? "Processing..." : "Decompose Task"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}