"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { ProductivityDashboard } from "@/app/components/ProductivityDashboard"
import { useState } from "react"
import { getLabels } from "@/app/actions/tasks"

export default function DashboardPage() {
  const [labels, setLabels] = useState([])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        lists={[]}
        labels={labels}
        overdueCount={0}
        onCreateList={() => alert('List creation would open a modal')}
        onCreateLabel={() => alert('Label creation would open a modal')}
      />
      <main className="flex-1 overflow-hidden p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">
            Productivity Dashboard
          </h1>
          <p className="text-muted-foreground mb-8">
            Your comprehensive productivity analytics and insights
          </p>
          <ProductivityDashboard userId="default" />
        </div>
      </main>
    </div>
  )
}