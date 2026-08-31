"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { taskFormAI } from "@/lib/ai/task-form-integration"
import { SuggestionContext } from "@/lib/context-aware-suggestions"
import { TaskSuggestion } from "@/lib/ai/task-form-integration"
import { Sparkles, Clock, AlertTriangle, Calendar } from "lucide-react"

interface AISuggestionsProps {
  context: SuggestionContext
  onSelectSuggestion: (suggestion: TaskSuggestion) => void
  className?: string
}

export function AISuggestions({ context, onSelectSuggestion, className = "" }: AISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSuggestions() {
      setLoading(true)
      try {
        const result = await taskFormAI.getSuggestions(context)
        setSuggestions(result)
      } catch (error) {
        console.error("Failed to load suggestions:", error)
      } finally {
        setLoading(false)
      }
    }

    loadSuggestions()
  }, [context])

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-muted-foreground">
        <Sparkles className="h-4 w-4 animate-pulse" />
        <span>Loading AI suggestions...</span>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-50" />
        <p>No suggestions available at this time</p>
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="font-medium flex items-center space-x-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>AI Suggestions</span>
      </h3>
      {suggestions.slice(0, 5).map((suggestion, index) => (
        <div
          key={suggestion.id}
          onClick={() => onSelectSuggestion(suggestion)}
          className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="font-medium">{suggestion.taskName}</h4>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  suggestion.priority === 'high' ? 'bg-red-100 text-red-700' :
                  suggestion.priority === 'low' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {suggestion.priority?.toUpperCase() || 'MED'}
                </span>
              </div>
              {suggestion.description && (
                <p className="text-sm text-muted-foreground mb-2">{suggestion.description}</p>
              )}
              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                {suggestion.estimatedMinutes && (
                  <span className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{suggestion.estimatedMinutes} min</span>
                  </span>
                )}
                {suggestion.suggestedDate && (
                  <span className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span>{suggestion.suggestedDate}</span>
                  </span>
                )}
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-primary" style={{ opacity: suggestion.relevanceScore }} />
                  <span>{Math.round(suggestion.relevanceScore * 100)}% match</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{suggestion.reason}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}