'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface ActivitySkeletonProps {
  variant?: 'mining' | 'ratting' | 'exploration' | 'abyssal'
  className?: string
}

export function ActivityDetailSkeleton({ variant = 'mining', className }: ActivitySkeletonProps) {
  const baseClasses = "animate-pulse bg-zinc-900/50 rounded-xl border border-white/5"

  return (
    <div className={cn("space-y-8", className)}>
      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className={cn(baseClasses, "h-20")}
          />
        ))}
      </div>

      {/* Content Skeleton */}
      {variant === 'mining' && (
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={cn(baseClasses, "h-64 rounded-[40px]")}
          />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className={cn(baseClasses, "h-32 rounded-[40px]")}
              />
            ))}
          </div>
        </div>
      )}

      {variant === 'ratting' && (
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={cn(baseClasses, "h-16 rounded-2xl")}
          />
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className={cn(baseClasses, "h-28 rounded-[40px]")}
            />
          ))}
        </div>
      )}

      {variant === 'exploration' && (
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={cn(baseClasses, "h-16 rounded-2xl")}
          />
          {[1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className={cn(baseClasses, "h-24 rounded-[40px]")}
            />
          ))}
        </div>
      )}

      {variant === 'abyssal' && (
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={cn(baseClasses, "h-48 rounded-[40px]")}
          />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className={cn(baseClasses, "h-24 rounded-2xl")}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}