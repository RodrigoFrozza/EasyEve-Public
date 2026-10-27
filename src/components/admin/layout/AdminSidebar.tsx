'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight, Shield, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADMIN_NAV } from '@/constants/admin-navigation'
import { useTranslations } from '@/i18n/hooks'

function isNavItemActive(pathname: string, href: string, siblingHrefs: string[]): boolean {
  if (pathname === href) return true
  if (!pathname.startsWith(href + '/')) return false
  return !siblingHrefs.some(
    (other) => other !== href && other.startsWith(href) && pathname.startsWith(other)
  )
}

export function AdminSidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const pathname = usePathname()
  const { t } = useTranslations()

  const defaultOpen = useMemo(
    () =>
      ADMIN_NAV.filter((e) => e.type === 'group').map((e) =>
        e.type === 'group' ? t(e.group.categoryKey) : ''
      ),
    [t]
  )

  const [openCategories, setOpenCategories] = useState<string[]>(defaultOpen)

  const toggleCategory = (label: string) => {
    setOpenCategories((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    )
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-white/[0.06] bg-ta-sidebar lg:static lg:z-auto',
        'transition-transform duration-200 lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="rounded-[9px] bg-eve-accent/[0.12] p-2">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {t('admin.title')}
            </p>
            <p className="text-xs text-muted-foreground">{t('admin.roleMaster')}</p>
          </div>
        </div>
        <button
          type="button"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-white/[0.04] lg:hidden"
          onClick={onMobileClose}
          aria-label={t('admin.nav.closeMenu')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {ADMIN_NAV.map((entry) => {
          if (entry.type === 'link') {
            const Icon = entry.icon
            const active = pathname === entry.href
            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-eve-accent/[0.09] text-eve-accent'
                    : 'text-ta-secondary hover:bg-white/[0.03] hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(entry.labelKey)}
              </Link>
            )
          }

          const { group } = entry
          const categoryLabel = t(group.categoryKey)
          const isOpen = openCategories.includes(categoryLabel)
          const Icon = group.icon
          const siblingHrefs = group.items.map((i) => i.href)

          return (
            <div key={group.categoryKey} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleCategory(categoryLabel)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isOpen
                    ? 'text-white bg-white/[0.04]'
                    : 'text-ta-secondary hover:bg-white/[0.03] hover:text-white'
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  {categoryLabel}
                </span>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                )}
              </button>

              {isOpen && (
                <div className="ml-3 border-l border-white/[0.06] pl-2 space-y-0.5">
                  {group.items.map((item) => {
                    const active = isNavItemActive(pathname, item.href, siblingHrefs)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onMobileClose}
                        className={cn(
                          'block rounded-md px-3 py-1.5 text-sm transition-colors',
                          active
                            ? 'bg-eve-accent/[0.09] text-eve-accent font-medium'
                            : 'text-ta-secondary hover:bg-white/[0.03] hover:text-white'
                        )}
                      >
                        {t(item.labelKey)}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-white/[0.06] px-4 py-3">
        <Link
          href="/dashboard"
          onClick={onMobileClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('admin.nav.backToDashboard')}
        </Link>
      </div>
    </aside>
  )
}
