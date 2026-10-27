'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SettingsSectionCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  children?: ReactNode
  className?: string
  contentClassName?: string
  loading?: boolean
}

export function SettingsSectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  contentClassName,
  loading,
}: SettingsSectionCardProps) {
  if (loading) {
    return (
      <Card className={cn('border-eve-border bg-eve-panel/50 backdrop-blur-md', className)}>
        <CardHeader>
          <div className="h-6 w-48 animate-pulse rounded bg-eve-dark" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-eve-dark" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-eve-border bg-eve-dark/50" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('border-eve-border bg-eve-panel/50 backdrop-blur-md', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          {Icon && <Icon className="h-5 w-5 text-eve-accent" />}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={cn('space-y-1', contentClassName)}>{children}</CardContent>
    </Card>
  )
}
