'use client'

import { eveTypeIconUrl } from '@/lib/eve-images'
import { cn } from '@/lib/utils'

type Props = {
  typeId: number
  name?: string
  size?: number
  className?: string
}

export function PiItemIcon({ typeId, name, size = 32, className }: Props) {
  return (
    <img
      src={eveTypeIconUrl(typeId, size)}
      alt={name ?? `Type ${typeId}`}
      width={size}
      height={size}
      className={cn('shrink-0 rounded bg-zinc-950/80', className)}
      loading="lazy"
    />
  )
}
