import { NextRequest, NextResponse } from "next/server"

/**
 * Health check endpoint for deployment verification.
 * Returns status: ok when the service is responsive.
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: "Service unavailable" },
      { status: 500 }
    )
  }
}
