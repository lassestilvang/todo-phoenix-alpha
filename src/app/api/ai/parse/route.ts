import { NextResponse } from "next/server"
import { nlpTaskParser } from "@/lib/ai/nlp-task-parser"

export async function POST(request: Request) {
  try {
    const { text, options } = await request.json()

    if (!text) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      )
    }

    const result = nlpTaskParser.parse(text)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error("NLP parsing error:", error)
    return NextResponse.json(
      { error: "Failed to parse natural language" },
      { status: 500 }
    )
  }
}