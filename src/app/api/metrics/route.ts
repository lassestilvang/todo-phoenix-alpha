import { NextResponse } from 'next/server';
import { monitoring } from '@/lib/monitoring';

/**
 * Prometheus-compatible metrics endpoint.
 * Returns system metrics for monitoring dashboards.
 */
export async function GET() {
  const metrics = monitoring.getSystemMetrics();
  const dbHealth = monitoring.checkDatabaseHealth();
  const integrationChecks = await monitoring.checkApiHealth();

  const prometheusOutput = `# HELP todo_phoenix_alpha_uptime_seconds System uptime in seconds
# TYPE todo_phoenix_alpha_uptime_seconds gauge
todo_phoenix_alpha_uptime_seconds ${metrics.uptimeSeconds}
# HELP todo_phoenix_alpha_total_requests Total API requests
# TYPE todo_phoenix_alpha_total_requests counter
todo_phoenix_alpha_total_requests ${metrics.totalRequests}
# HELP todo_phoenix_alpha_total_errors Total API errors
# TYPE todo_phoenix_alpha_total_errors counter
todo_phoenix_alpha_total_errors ${metrics.totalErrors}
# HELP todo_phoenix_alpha_error_rate_percent Error rate percentage
# TYPE todo_phoenix_alpha_error_rate_percent gauge
todo_phoenix_alpha_error_rate_percent ${metrics.errorRate.toFixed(2)}
# HELP todo_phoenix_alpha_avg_response_time_ms Average response time in milliseconds
# TYPE todo_phoenix_alpha_avg_response_time_ms gauge
todo_phoenix_alpha_avg_response_time_ms ${metrics.avgResponseTimeMs}
# HELP todo_phoenix_alpha_database_health Database health status
# TYPE todo_phoenix_alpha_database_health gauge
todo_phoenix_alpha_database_health ${dbHealth.status === 'healthy' ? 1 : 0}
# HELP todo_phoenix_alpha_database_response_time_ms Database query response time
# TYPE todo_phoenix_alpha_database_response_time_ms gauge
todo_phoenix_alpha_database_response_time_ms ${dbHealth.responseTimeMs}
`;

  return new Response(prometheusOutput, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}