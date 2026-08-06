import { toast } from 'sonner'
import { logger } from '@/lib/server-logger'

/**
 * Common error handler for Admin components to standardize toast messages and logging.
 */
export const handleAdminError = (error: unknown, fallbackMessage: string) => {
  console.error(fallbackMessage, error)
  
  let message = fallbackMessage
  
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'object' && error !== null && 'error' in error) {
    message = String((error as any).error)
  }
  
  toast.error(message)
  
  // Also log to our server-side logger if we're in a context where that's possible
  // (Note: this runs on the client, so logger might behave differently)
  if (typeof window === 'undefined') {
    logger.error('ADMIN_UI', fallbackMessage, error)
  }
}

/**
 * Extracts a readable error message from various error formats.
 */
export const getErrorMessage = (error: unknown, fallback: string = 'An unexpected error occurred'): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null) {
    if ('error' in error) return String((error as any).error)
    if ('message' in error) return String((error as any).message)
  }
  return fallback
}
