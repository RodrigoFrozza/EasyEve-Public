'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface ActivitySkeletonProps {
  variant?: 'mining' | 'ratting' | 'exploration' | 'salvaging' | 'abyssal'
  className?: string
}

export function ActivityDetailSkeleton({ variant = 'mining', className }: ActivitySkeletonProps) {
  const baseClasses = "animate-pulse bg-zinc-900/80 rounded-none border border-zinc-800"

  return (
    <div className={cn("space-y-8", className)}>
      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(baseClasses, "h-20")}
          />
        ))}
      </div>

      {/* Content Skeleton */}
      {variant === 'mining' && (
        <div className="space-y-6">
          <div 
            className={cn(baseClasses, "h-64")}
          />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(baseClasses, "h-32")}
              />
            ))}
          </div>
        </div>
      )}

      {variant === 'ratting' && (
        <div className="space-y-4">
          <div 
            className={cn(baseClasses, "h-16")}
          />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(baseClasses, "h-28")}
            />
          ))}
        </div>
      )}

      {(variant === 'exploration' || variant === 'salvaging') && (
        <div className="space-y-4">
          <div 
            className={cn(baseClasses, "h-16")}
          />
          {[1, 2].map((i) => (
            <div
              key={i}
              className={cn(baseClasses, "h-24")}
            />
          ))}
        </div>
      )}

      {variant === 'abyssal' && (
        <div className="space-y-6">
          <div 
            className={cn(baseClasses, "h-48")}
          />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(baseClasses, "h-24")}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}