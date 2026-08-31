import { NextResponse } from "next/server"
import { taskDecompositionEngine } from "@/lib/ai/task-decomposition-engine"

export async function POST(request: Request) {
  try {
    const { taskName, taskDescription, context } = await request.json()

    if (!taskName) {
      return NextResponse.json(
        { error: "taskName is required" },
        { status: 400 }
      )
    }

    const decomposition = taskDecompositionEngine.decomposeTask(
      taskName,
      taskDescription || "",
      context
    )

    return NextResponse.json({
      success: true,
      data: decomposition
    })
  } catch (error) {
    console.error("Task decomposition error:", error)
    return NextResponse.json(
      { error: "Failed to decompose task" },
      { status: 500 }
    )
  }
}