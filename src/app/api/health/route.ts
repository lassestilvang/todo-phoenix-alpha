import { NextRequest, NextResponse } from "next/server";
import { monitoring } from "@/lib/monitoring";
import { dataCache as cache } from "@/lib/cache";

/**
 * Health check endpoint for deployment verification and monitoring.
 * Returns status: ok when the service is responsive, plus metrics.
 */
export async function GET(request: NextRequest) {
  try {
    const systemMetrics = monitoring.getSystemMetrics();
    const dbHealth = monitoring.checkDatabaseHealth();
    const integrationChecks = await monitoring.checkApiHealth();
    const cacheStats = cache.getStats ? cache.getStats() : { size: 0, keys: 0 };

    const overallStatus =
      dbHealth.status === "healthy"
        ? "ok"
        : "degraded";

    const statusCode = overallStatus === "ok" ? 200 : 503;

    return NextResponse.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealth,
          integrations: integrationChecks,
          cache: cacheStats,
        },
        metrics: systemMetrics,
      },
      { status: statusCode }
    );
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        message: "Service unavailable",
        checks: null,
        metrics: null,
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler for logging custom health events (e.g., manual checks).
 * Can be used by uptime monitors or CI to record health status.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { event = "manual_check", severity = "info" } = body;

    return NextResponse.json(
      {
        status: "logged",
        event,
        severity,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: "Failed to log health event" },
      { status: 500 }
    );
  }
}