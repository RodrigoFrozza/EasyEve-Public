'use client'

import { eveTypeIconUrl } from '@/lib/eve-images'
import { getPlanetTypeId } from '@/lib/pi/pi-static-data'
import { cn } from '@/lib/utils'

type Props = {
  planetType: string
  label?: string
  size?: number
  className?: string
}

export function PiPlanetIcon({ planetType, label, size = 40, className }: Props) {
  const typeId = getPlanetTypeId(planetType)
  if (!typeId) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold uppercase text-violet-200',
          className
        )}
        style={{ width: size, height: size }}
      >
        {planetType.slice(0, 2)}
      </div>
    )
  }

  // Planet celestial types expose `icon` on the image server, not `render`.
  return (
    <img
      src={eveTypeIconUrl(typeId, size)}
      alt={label ?? planetType}
      width={size}
      height={size}
      className={cn('shrink-0 rounded-full bg-zinc-950/80 object-cover', className)}
      loading="lazy"
    />
  )
}
