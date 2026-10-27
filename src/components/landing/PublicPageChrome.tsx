'use client'

import { cn } from '@/lib/utils'
import { StarField } from '@/components/landing/StarField'

type PublicPageChromeProps = {
  children: React.ReactNode
  className?: string
  /** Centered layout (login) vs full-page scroll (landing) */
  centered?: boolean
}

export function PublicPageChrome({
  children,
  className,
  centered = false,
}: PublicPageChromeProps) {
  return (
    <div
      className={cn(
        'relative min-h-screen bg-[#03070c] text-eve-text font-sans selection:bg-eve-accent/30 selection:text-eve-text',
        centered ? 'flex items-center justify-center overflow-hidden' : 'overflow-x-hidden custom-scrollbar',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.4]">
        <StarField variant="subtle" />
      </div>

      <div className="absolute inset-0 bg-transparent tech-grid-bg opacity-[0.03] pointer-events-none z-0" />

      <div className="pointer-events-none absolute -left-[150px] -top-[150px] z-0 h-[300px] w-[300px] bg-eve-accent-radial-soft" />
      <div className="pointer-events-none absolute -right-[100px] top-1/4 z-0 h-[250px] w-[250px] bg-eve-accent-radial-soft opacity-60" />

      {/* `isolate` creates a stacking context so descendants promoted to their own
          GPU compositing layer (e.g. framer-motion transforms in the shared
          CharacterProfileView) compose ABOVE the z-0 star/grid backgrounds instead
          of falling behind the near-black container bg and painting as a blank void. */}
      <div
        className={cn(
          'relative isolate z-10 flex min-h-screen w-full',
          centered ? 'flex-col items-center justify-center' : 'flex-col'
        )}
      >
        {children}
      </div>
    </div>
  )
}
