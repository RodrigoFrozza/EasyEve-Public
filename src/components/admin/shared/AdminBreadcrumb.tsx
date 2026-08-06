'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { ADMIN_BREADCRUMB_KEYS } from '@/constants/admin-navigation'
import { useTranslations } from '@/i18n/hooks'

export function AdminBreadcrumb() {
  const pathname = usePathname()
  const { t } = useTranslations()
  const segments = pathname.split('/').filter((s) => s !== '')

  const adminIndex = segments.indexOf('admin')
  if (adminIndex === -1) return null

  const breadcrumbSegments = segments.slice(adminIndex)

  const breadcrumbs = breadcrumbSegments.map((segment, index) => {
    const href = '/' + segments.slice(0, adminIndex + index + 1).join('/')
    const isLast = index === breadcrumbSegments.length - 1
    const labelKey = ADMIN_BREADCRUMB_KEYS[segment]
    const label = labelKey ? t(labelKey) : segment.replace(/-/g, ' ')

    return { href, label, isLast }
  })

  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <Link
        href="/dashboard/admin"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span>{t('admin.nav.overview')}</span>
      </Link>

      {breadcrumbs.slice(1).map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
