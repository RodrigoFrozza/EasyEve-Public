import { NextResponse } from 'next/server'
import { AppError, isAppError } from './app-error'
import { ErrorCodes } from './error-codes'
import { ZodError, ZodSchema } from 'zod'
import { logger } from './server-logger'

export type ApiHandler = (req: Request, ...args: any[]) => Promise<Response | NextResponse | any>

function isDatabaseError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    const name = error.name.toLowerCase()
    return (
      name.includes('prisma') ||
      name.includes('database') ||
      message.includes('prisma') ||
      message.includes('database') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('timeout') ||
      message.includes('p1001') || // Postgres timeout
      message.includes('p1002') ||
      message.includes('p1003') ||
      message.includes('p2002') || // Prisma unique constraint
      message.includes('p2003') || // Prisma foreign key
      message.includes('p2025') || // Prisma record not found
      message.includes('sqlite') ||
      message.includes('postgresql')
    )
  }
  return false
}

function getDatabaseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message
    if (message.includes('P1001') || message.includes('timeout')) {
      return 'Database server timeout'
    }
    if (message.includes('P1002')) {
      return 'Database query timeout'
    }
    if (message.includes('P2002')) {
      return 'Unique constraint violation'
    }
    if (message.includes('P2003')) {
      return 'Foreign key constraint violation'
    }
    if (message.includes('P2025')) {
      return 'Database record not found'
    }
    return message
  }
  return 'Database operation failed'
}

/**
 * Higher-order function to wrap API handlers with centralized error handling.
 * Automatically catches AppErrors, ZodErrors, and generic Errors.
 */
export function withErrorHandling(handler: ApiHandler) {
  return async (req: Request, ...args: any[]) => {
    try {
      const response = await handler(req, ...args)
      
      // If the handler already returned a Response/NextResponse, return it
      if (response instanceof Response) {
        return response
      }
      
      // Otherwise, wrap the result in a JSON response
      return NextResponse.json(response)
    } catch (error) {
      logger.error('API', `${req.method} ${req.url}`, error)

      // Handle custom AppErrors
      if (isAppError(error)) {
        return NextResponse.json(
          { 
            error: error.message, 
            code: error.code,
            details: error.details 
          }, 
          { status: error.statusCode }
        )
      }

      // Handle Zod validation errors
      if (error instanceof ZodError) {
        return NextResponse.json(
          { 
            error: 'Invalid input data', 
            code: ErrorCodes.VALIDATION_FAILED,
            details: error.issues.map(e => ({
              path: e.path.join('.'),
              message: e.message
            }))
          }, 
          { status: 400 }
        )
      }

      // Handle database errors specifically
      if (isDatabaseError(error)) {
        const isDev = process.env.NODE_ENV === 'development'
        const dbMessage = getDatabaseErrorMessage(error)
        
        // Map specific Prisma codes to better user messages
        let userMessage = 'Database error'
        if (dbMessage.includes('Unique constraint')) userMessage = 'A record with this value already exists'
        if (dbMessage.includes('Foreign key')) userMessage = 'Related record not found'
        if (dbMessage.includes('record not found')) userMessage = 'The requested data was not found'

        return NextResponse.json(
          { 
            error: userMessage,
            code: ErrorCodes.DATABASE_ERROR,
            details: isDev ? dbMessage : 'Database operation failed.',
            stack: isDev && error instanceof Error ? error.stack : undefined
          }, 
          { status: 500 }
        )
      }

      // Handle unexpected errors
      const isDev = process.env.NODE_ENV === 'development'
      return NextResponse.json(
        { 
          error: 'Internal server error', 
          code: ErrorCodes.API_SERVER_ERROR,
          details: isDev && error instanceof Error ? error.message : undefined,
          stack: isDev && error instanceof Error ? error.stack : undefined
        }, 
        { status: 500 }
      )
    }
  }
}

/**
 * Helper to validate request body with a Zod schema.
 * Throws ZodError on failure, which is caught by withErrorHandling.
 */
export async function validateBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  try {
    const body = await req.json()
    return schema.parse(body)
  } catch (error) {
    if (error instanceof ZodError) {
      throw error
    }
    // Handle cases where body is not valid JSON
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Request body is not a valid JSON', 400)
  }
}

/**
 * Helper to validate search parameters with a Zod schema.
 */
export function validateParams<T>(url: string, schema: ZodSchema<T>): T {
  const { searchParams } = new URL(url)
  const params = Object.fromEntries(searchParams.entries())
  return schema.parse(params)
}
