"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useTaskCollaboration, CollaborationMessage, UserPresence, TaskComment } from "@/lib/hooks/use-collaboration"

interface CollaborationContextType {
  connected: boolean
  clientCount: number
  presence: Map<string, UserPresence>
  comments: Map<string, TaskComment[]>
  taskUpdates: Map<number, any>
  sendMessage: (data: any) => void
  setUserRooms: (rooms: Set<string>) => void
}

const CollaborationContext = createContext<CollaborationContextType | null>(null)

export function CollaborationProvider({
  userId,
  children
}: {
  userId: string
  children: React.ReactNode
}) {
  const collab = useTaskCollaboration(userId)
  const [comments, setComments] = useState<Map<string, TaskComment[]>>(new Map())

  const handleMessage = useCallback((data: CollaborationMessage) => {
    switch (data.type) {
      case "task-comment":
        setComments(prev => {
          const next = new Map(prev)
          const taskId = data.payload.taskId
          const existing = next.get(taskId) || []
          next.set(taskId, [...existing, data.payload])
          return next
        })
        break
    }
  }, [])

  // Join a task room when component mounts
  useEffect(() => {
    // User rooms are managed by useTaskCollaboration internally
  }, [])

  const value: CollaborationContextType = {
    connected: collab.connected,
    clientCount: collab.clientCount,
    presence: collab.presence,
    comments,
    taskUpdates: collab.taskUpdates as any,
    sendMessage: collab.sendMessage,
    setUserRooms: collab.setUserRooms
  }

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  )
}

export function useCollaborationContext() {
  const context = useContext(CollaborationContext)
  if (!context) {
    throw new Error("useCollaborationContext must be used within a CollaborationProvider")
  }
  return context
}