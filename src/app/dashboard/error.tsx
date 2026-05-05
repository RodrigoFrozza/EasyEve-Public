'use client'

import { useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'

function isLikelyMinifiedReactMessage(message: string) {
  return (
    message.includes('Minified React error') ||
    message.includes('reactjs.org/docs/error-decoder') ||
    message.includes('invariant=')
  )
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard]', error)
  }, [error])

  const userMessage = useMemo(() => {
    const raw = (error?.message || '').trim()
    if (!raw) {
      return 'Something went wrong in the dashboard. You can try again or reload the page.'
    }
    if (isLikelyMinifiedReactMessage(raw)) {
      return 'A display error occurred in the dashboard. Try again; if it keeps happening, open the browser console and share the error with the team.'
    }
    return raw
  }, [error])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold text-white">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">{userMessage}</p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground/80 font-mono">Reference: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={() => reset()} variant="outline" className="border-eve-border">
          Try again
        </Button>
        <Button type="button" onClick={() => window.location.reload()} variant="secondary" className="border-eve-border">
          Reload page
        </Button>
      </div>
    </div>
  )
}
