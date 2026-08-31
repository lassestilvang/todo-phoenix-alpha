import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Global API middleware for request logging and monitoring.
 * Captures request metrics for /api/* routes.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only instrument API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const startTime = Date.now();

  // Add request ID to response headers for correlation
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const response = NextResponse.next();

  // We'll use a background measurement approach: log on response completion
  // by attaching timing data to headers (available in route handlers)
  response.headers.set('X-Request-Id', requestId);
  response.headers.set('X-Request-Start', String(startTime));

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
