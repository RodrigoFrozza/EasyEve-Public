'use client'

import { useEffect } from 'react'
import { remoteLogger } from '@/lib/remote-logger'

/**
 * LogManager
 * Global interceptor for client-side errors.
 * Automatically captures window errors and overrides console.error.
 */
export function LogManager() {
  useEffect(() => {
    // 1. Capture Uncaught Exceptions
    // The message goes into the title: remoteLogger only falls back to the
    // error's own message when the title is empty, so DebugLog rows used to
    // read just "Uncaught Exception" with the cause buried in the stack.
    const handleGlobalError = (event: ErrorEvent) => {
      const detail = event.error?.message || event.message
      remoteLogger.error(detail ? `Uncaught Exception: ${detail}` : 'Uncaught Exception', event.error || event.message)
    }

    // 2. Capture Unhandled Promise Rejections
    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const detail = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : ''
      remoteLogger.error(detail ? `Unhandled Promise Rejection: ${detail}` : 'Unhandled Promise Rejection', reason)
    }

    // 3. Override console.error
    const originalConsoleError = console.error
    console.error = (...args: any[]) => {
      // Still log to the original console
      originalConsoleError.apply(console, args)

      // Send to remote logger
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ')
      
      remoteLogger.error(`Console Error: ${message}`)
    }

    window.addEventListener('error', handleGlobalError)
    window.addEventListener('unhandledrejection', handlePromiseRejection)

    return () => {
      window.removeEventListener('error', handleGlobalError)
      window.removeEventListener('unhandledrejection', handlePromiseRejection)
      console.error = originalConsoleError
    }
  }, [])

  return null // Non-visual component
}
