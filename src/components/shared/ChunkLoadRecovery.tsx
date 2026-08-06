'use client'

import { useEffect } from 'react'
import { isChunkLoadError, tryRecoverFromChunkLoadError } from '@/lib/chunk-load-recovery'

export function ChunkLoadRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (tryRecoverFromChunkLoadError(event.error ?? event.message)) {
        event.preventDefault()
      }
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (tryRecoverFromChunkLoadError(event.reason)) {
        event.preventDefault()
      }
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}

export { isChunkLoadError }
