/**
 * Remote Logger Utility
 * Handles sending client-side errors to the backend for analysis.
 */

import { getErrorCode, isAppError } from './app-error'
import type { ErrorCode } from './error-codes'

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogData {
  message: string
  level: LogLevel
  stack?: string
  code?: ErrorCode
  context?: any
  characterId?: number
}

class RemoteLogger {
  private queue: LogData[] = []
  private timer: NodeJS.Timeout | null = null
  private batchSize = 10
  private flushInterval = 5000 // 5 seconds

  private async flush() {
    if (this.queue.length === 0) return

    const logsToSend = [...this.queue]
    this.queue = []
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch: logsToSend,
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      })
    } catch (err) {
      console.warn('[RemoteLogger] Failed to send batched logs', err)
    }
  }

  private enqueue(data: LogData) {
    // Restriction: User requested only errors, never warnings
    if (data.level !== 'error') return

    this.queue.push(data)

    if (this.queue.length >= this.batchSize) {
      this.flush()
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval)
    }
  }

  error(message: string, error?: Error | any, context?: any) {
    let finalMessage = message
    let stack = undefined
    let code = undefined

    if (isAppError(error)) {
      if (!finalMessage) finalMessage = error.message
      stack = error.stack
      code = error.code
    } else if (error instanceof Error) {
      if (!finalMessage) finalMessage = error.message
      stack = error.stack
      code = getErrorCode(error) || undefined
    } else if (typeof error === 'string') {
      stack = new Error(error).stack
    } else if (error) {
      stack = JSON.stringify(error)
    }

    this.enqueue({
      level: 'error',
      message: finalMessage || 'Unknown error',
      stack,
      code,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
      },
    })
  }
}

export const remoteLogger = new RemoteLogger()
