import { NextResponse } from "next/server"
import { generateTaskSuggestions } from "@/lib/ai/enhancement"

export async function POST(request: Request) {
  try {
    const { taskData, timeEntries } = await request.json()

    if (!taskData) {
      return NextResponse.json(
        { error: "taskData is required" },
        { status: 400 }
      )
    }

    const result = await generateTaskSuggestions({
      priority: taskData.priority,
      estimate_minutes: taskData.estimate_minutes,
      date: taskData.deadline,
    })

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error("Task suggestions error:", error)
    return NextResponse.json(
      { error: "Failed to generate task suggestions" },
      { status: 500 }
    )
  }
}