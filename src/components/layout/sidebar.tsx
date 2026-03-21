"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Inbox, Calendar, CalendarDays, ListTodo, Search, 
  Plus, Settings, ChevronLeft, ChevronRight, Tag,
  Sun, Moon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useTheme } from "next-themes"
import type { List, Label } from "@/lib/types"

interface SidebarProps {
  lists: List[]
  labels: Label[]
  overdueCount: number
  onCreateList: () => void
  onCreateLabel: () => void
}

export function Sidebar({ 
  lists, 
  labels, 
  overdueCount, 
  onCreateList,
  onCreateLabel 
}: SidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  const views = [
    { name: "Today", icon: Calendar, href: "/?view=today" },
    { name: "Next 7 Days", icon: CalendarDays, href: "/?view=next_7_days" },
    { name: "Upcoming", icon: ListTodo, href: "/?view=upcoming" },
    { name: "All", icon: Inbox, href: "/?view=all" },
  ]

  const isActive = (href: string) => {
    if (href.includes("view=")) {
      const viewParam = href.split("view=")[1]
      const currentView = new URLSearchParams(pathname.split("?")[1]).get("view")
      return currentView === viewParam
    }
    return pathname === href
  }

  return (
    <motion.div
      initial={false}
      animate={{ width: collapsed ? 64 : 280 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="flex flex-col border-r bg-background"
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.h1
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="text-xl font-bold"
            >
              Task Planner
            </motion.h1>
          )}
        </AnimatePresence>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-2">
          {/* Views */}
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-1"
            >
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Views
              </div>
              {views.map((view) => (
                <Link key={view.href} href={view.href}>
                  <Button
                    variant={isActive(view.href) ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      isActive(view.href) && "bg-secondary"
                    )}
                  >
                    <view.icon className="h-4 w-4" />
                    {!collapsed && <span className="ml-2">{view.name}</span>}
                  </Button>
                </Link>
              ))}
              {overdueCount > 0 && (
                <Link href="/?view=overdue">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Inbox className="h-4 w-4" />
                    {!collapsed && (
                      <>
                        <span className="ml-2">Overdue</span>
                        <Badge variant="destructive" className="ml-auto">
                          {overdueCount}
                        </Badge>
                      </>
                    )}
                  </Button>
                </Link>
              )}
            </motion.div>
          )}

          {collapsed && (
            <div className="space-y-1">
              {views.map((view) => (
                <Link key={view.href} href={view.href}>
                  <Button
                    variant={isActive(view.href) ? "secondary" : "ghost"}
                    size="icon"
                    className={cn("w-full", isActive(view.href) && "bg-secondary")}
                  >
                    <view.icon className="h-4 w-4" />
                  </Button>
                </Link>
              ))}
            </div>
          )}

          <Separator />

          {/* Lists */}
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <div className="text-xs font-semibold text-muted-foreground">
                  Lists
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={onCreateList}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {lists.map((list) => (
                <Link key={list.id} href={`/?list=${list.id}`}>
                  <Button
                    variant={pathname.includes(`list=${list.id}`) ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    <span className="text-lg">{list.emoji}</span>
                    <span className="ml-2">{list.name}</span>
                  </Button>
                </Link>
              ))}
            </motion.div>
          )}

          {collapsed && (
            <div className="space-y-1">
              {lists.map((list) => (
                <Link key={list.id} href={`/?list=${list.id}`}>
                  <Button
                    variant={pathname.includes(`list=${list.id}`) ? "secondary" : "ghost"}
                    size="icon"
                    className="w-full"
                    title={list.name}
                  >
                    <span className="text-lg">{list.emoji}</span>
                  </Button>
                </Link>
              ))}
            </div>
          )}

          <Separator />

          {/* Labels */}
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <div className="text-xs font-semibold text-muted-foreground">
                  Labels
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={onCreateLabel}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {labels.map((label) => (
                <Link key={label.id} href={`/?label=${label.id}`}>
                  <Button
                    variant={pathname.includes(`label=${label.id}`) ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    <span className="text-lg">{label.emoji}</span>
                    <span className="ml-2">{label.name}</span>
                  </Button>
                </Link>
              ))}
            </motion.div>
          )}

          {collapsed && (
            <div className="space-y-1">
              {labels.map((label) => (
                <Link key={label.id} href={`/?label=${label.id}`}>
                  <Button
                    variant={pathname.includes(`label=${label.id}`) ? "secondary" : "ghost"}
                    size="icon"
                    className="w-full"
                    title={label.name}
                  >
                    <span className="text-lg">{label.emoji}</span>
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-2">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
        {collapsed && (
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
