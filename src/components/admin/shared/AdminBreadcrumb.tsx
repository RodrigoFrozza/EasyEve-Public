'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

const LABEL_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  admin: 'Admin',
  users: 'Users',
  finance: 'Finance',
  content: 'Content',
  system: 'System',
  security: 'Security',
  accounts: 'Accounts',
  codes: 'Codes',
  subscriptions: 'Subscriptions',
  'tester-applications': 'Tester Applications',
  payments: 'Payments',
  'module-prices': 'Modules',
  campaigns: 'Campaigns',
  'promo-banners': 'Promo Banners',
  carousel: 'Carousel',
  news: 'News',
  medals: 'Medals',
  health: 'Health Monitor',
  scripts: 'Scripts',
  schedules: 'Scheduled Jobs',
  logs: 'System Logs',
}

function formatSegment(segment: string): string {
  if (LABEL_MAP[segment]) return LABEL_MAP[segment]
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
}

export function AdminBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(s => s !== '')

  const adminIndex = segments.indexOf('admin')
  if (adminIndex === -1) return null

  const breadcrumbSegments = segments.slice(adminIndex)

  const breadcrumbs = breadcrumbSegments.map((segment, index) => {
    const href = '/' + segments.slice(0, adminIndex + index + 1).join('/')
    const isLast = index === breadcrumbSegments.length - 1
    const label = formatSegment(segment)

    return { href, label, isLast }
  })

  return (
    <nav className="flex items-center gap-1 text-sm pb-4">
      <Link href="/dashboard/admin" className="text-eve-text/40 hover:text-eve-accent">
        Admin
      </Link>
      {breadcrumbs.map((crumb) => (
        <div key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3 text-eve-text/20" />
          {crumb.isLast ? (
            <span className="text-eve-text">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="text-eve-text/40 hover:text-eve-accent">
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
