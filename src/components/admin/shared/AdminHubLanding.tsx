'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AdminPageContainer } from './AdminPageContainer'
import { useTranslations } from '@/i18n/hooks'

export type AdminHubSection = {
  labelKey: string
  descriptionKey?: string
  href: string
  icon: LucideIcon
}

export function AdminHubLanding({
  titleKey,
  descriptionKey,
  sections,
}: {
  titleKey: string
  descriptionKey: string
  sections: AdminHubSection[]
}) {
  const { t } = useTranslations()

  return (
    <AdminPageContainer title={t(titleKey)} description={t(descriptionKey)}>
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <Link
              key={section.href}
              href={section.href}
              className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex gap-4 min-w-0">
                <div className="rounded-md bg-primary/10 p-2.5 shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{t(section.labelKey)}</p>
                  {section.descriptionKey && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {t(section.descriptionKey)}
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </Link>
          )
        })}
      </div>
    </AdminPageContainer>
  )
}
