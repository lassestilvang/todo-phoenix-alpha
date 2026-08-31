"use client"

import React, { useMemo } from "react"
import { useCollaborationContext } from "./../collaboration/CollaborationProvider"
import { cn } from "@/lib/utils"

export interface UserPresenceIndicatorProps {
  className?: string
  showStatus?: boolean
  showTask?: boolean
  compact?: boolean
}

export function UserPresenceIndicator({
  className,
  showStatus = true,
  showTask = true,
  compact = false
}: UserPresenceIndicatorProps) {
  const { presence, connected, clientCount } = useCollaborationContext()

  const connectedUsers = useMemo(() => {
    return Array.from(presence.values()).filter(
      user => user.status === 'online'
    )
  }, [presence])

  if (!connected) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
        <span className="text-sm text-gray-500">Disconnected</span>
      </div>
    )
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <span className="text-xs text-gray-600">
          {connectedUsers.length}/{clientCount} online
        </span>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg bg-gray-50", className)}>
      <div className="flex -space-x-2">
        {connectedUsers.slice(0, 5).map((user) => (
          <div
            key={user.userId}
            className="relative h-8 w-8 rounded-full border-2 border-white bg-gray-200"
            title={`${user.userId} - ${user.status}${showTask && user.currentTask ? ` (working on task ${user.currentTask})` : ''}`}
          >
            <div
              className={cn(
                "h-full w-full rounded-full",
                user.status === 'online' && "bg-green-500",
                user.status === 'away' && "bg-yellow-500",
                user.status === 'busy' && "bg-red-500",
                user.status === 'offline' && "bg-gray-300"
              )}
            />
          </div>
        ))}
        {connectedUsers.length > 5 && (
          <div className="h-8 w-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center">
            <span className="text-xs text-gray-600 font-medium">
              +{connectedUsers.length - 5}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900">
          {connectedUsers.length} user{connectedUsers.length !== 1 ? 's' : ''} online
        </div>
        {connectedUsers.length > 0 && (
          <div className="text-xs text-gray-500">
            {connectedUsers.map(u => u.userId).join(', ')}
          </div>
        )}
      </div>

      {showStatus && connectedUsers.length > 0 && (
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-600">Live</span>
        </div>
      )}
    </div>
  )
}

export default UserPresenceIndicator