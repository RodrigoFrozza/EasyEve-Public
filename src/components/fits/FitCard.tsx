'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Fit } from '@/types/fit'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Lock, Globe, Clock, Trash2, Ship, Boxes, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

interface FitCardProps {
  fit: Fit
  onDelete?: (id: string) => void
}

export const FitCard: React.FC<FitCardProps> = ({ fit, onDelete }) => {
  const [imgError, setImgError] = useState(false)

  const imgSrc = imgError || !fit.shipId
    ? ''
    : `https://images.evetech.net/types/${fit.shipId}/render?size=256`

  return (
    <Card className="group relative overflow-hidden border-border/80 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_14px_38px_rgba(0,0,0,0.25)]">
      <div className="absolute left-3 top-3 z-10">
        {fit.visibility === 'PUBLIC' ? (
          <Badge className="gap-1 border-emerald-500/30 bg-emerald-500/10 px-2 py-0 text-[10px] font-semibold tracking-wide text-emerald-300">
            <Globe className="h-3 w-3" /> Public
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-border/80 bg-card/70 px-2 py-0 text-[10px] font-semibold tracking-wide text-muted-foreground">
            <Lock className="h-3 w-3" /> Protected
          </Badge>
        )}
      </div>

      <div className="relative aspect-square overflow-hidden bg-muted/20">
        {imgSrc && !imgError ? (
          <Image
            src={imgSrc}
            alt={fit.ship}
            fill
            className="object-contain p-6 transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Ship className="h-1/2 w-1/2 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-70" />
      </div>

      <CardContent className="relative space-y-3 p-4">
        <div className="space-y-1.5">
          <h3 className="truncate text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
            {fit.name}
          </h3>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary/75" />
            {fit.ship}
          </p>
        </div>

        {fit.tags && fit.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {fit.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="h-5 border-border/90 bg-muted/30 px-2 text-[10px] font-medium text-muted-foreground"
              >
                {tag}
              </Badge>
            ))}
            {fit.tags.length > 3 && (
              <span className="text-[11px] text-muted-foreground">+{fit.tags.length - 3}</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/80 bg-muted/20 p-2 text-center">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mods</p>
            <p className="text-sm font-semibold text-foreground">{fit.modules.length}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Drones</p>
            <p className="text-sm font-semibold text-foreground">{fit.drones.length}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cargo</p>
            <p className="text-sm font-semibold text-foreground">{fit.cargo.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Updated {formatDistanceToNow(new Date(fit.updatedAt), { addSuffix: true })}</span>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 p-4 pt-0">
        <Button asChild size="sm" variant="secondary" className="h-9 flex-1 gap-1.5 text-xs font-medium">
          <Link href={`/dashboard/fits/editor?id=${fit.id}`}>
            <Boxes className="h-3.5 w-3.5" />
            Open Editor
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-9 w-9 border-border/90 p-0 text-muted-foreground hover:text-foreground"
        >
          <Link href={`/fits/${fit.id}`} target="_blank">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-9 w-9 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete?.(fit.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardFooter>
    </Card>
  )
}
