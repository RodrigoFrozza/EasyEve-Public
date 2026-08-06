'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function CharactersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard/characters]', error)
  }, [error])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold text-white">Could not load characters</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        We could not load your character data right now. Try again in a few seconds.
      </p>
      {error.digest ? <p className="font-mono text-xs text-muted-foreground/80">Reference: {error.digest}</p> : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={() => reset()} variant="outline" className="border-eve-border">
          Try again
        </Button>
        <Button
          type="button"
          onClick={() => window.location.reload()}
          variant="secondary"
          className="border-eve-border"
        >
          Reload page
        </Button>
      </div>
    </div>
  )
}
