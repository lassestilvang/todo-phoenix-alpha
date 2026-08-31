import { NextRequest, NextResponse } from 'next/server'

export interface ApiErrorResponse {
  success: false
  error: string
  code?: string
  details?: unknown
}

export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export class ApiError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(message, 400, 'BAD_REQUEST', details)
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new ApiError(message, 401, 'UNAUTHORIZED')
  }

  static forbidden(message: string = 'Forbidden') {
    return new ApiError(message, 403, 'FORBIDDEN')
  }

  static notFound(message: string = 'Not found') {
    return new ApiError(message, 404, 'NOT_FOUND')
  }

  static conflict(message: string, details?: unknown) {
    return new ApiError(message, 409, 'CONFLICT', details)
  }

  static internal(message: string = 'Internal server error', details?: unknown) {
    return new ApiError(message, 500, 'INTERNAL_ERROR', details)
  }

  static serviceUnavailable(message: string = 'Service unavailable') {
    return new ApiError(message, 503, 'SERVICE_UNAVAILABLE')
  }

  toResponse(): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
      {
        success: false,
        error: this.message,
        code: this.code,
        details: this.details,
      },
      { status: this.statusCode }
    )
  }
}

export function createSuccessResponse<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data })
}

export function createErrorResponse(error: ApiError): NextResponse<ApiErrorResponse> {
  return error.toResponse()
}

export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  if (error instanceof ApiError) {
    return error.toResponse()
  }

  if (error instanceof Error) {
    console.error('API Error:', error)
    return ApiError.internal(error.message).toResponse()
  }

  console.error('Unknown API Error:', error)
  return ApiError.internal('An unexpected error occurred').toResponse()
}

export function withErrorHandling<T>(
  handler: (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse<ApiResponse<T>>>
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse<ApiResponse<T>>> => {
    try {
      return await handler(request, context)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

export function withValidation<T>(
  schema: { parse: (data: unknown) => T },
  handler: (request: NextRequest, data: T) => Promise<NextResponse<ApiResponse<T>>>
) {
  return withErrorHandling(async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    let data: T

    try {
      const body = await request.json()
      data = schema.parse(body)
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        interface ValidationError {
          path: (string | number)[];
          message: string;
        }
        const details = (error as { issues: ValidationError[] }).issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return ApiError.badRequest('Validation failed', details).toResponse();
      }
      return ApiError.badRequest('Invalid request body').toResponse();
    }

    return handler(request, data)
  })
}