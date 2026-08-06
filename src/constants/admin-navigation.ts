import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  Settings,
  Shield,
  Flag,
  Activity,
} from 'lucide-react'

export type AdminNavItem = {
  labelKey: string
  href: string
}

export type AdminNavGroup = {
  categoryKey: string
  icon: LucideIcon
  items: AdminNavItem[]
}

export type AdminNavEntry =
  | { type: 'link'; labelKey: string; href: string; icon: LucideIcon }
  | { type: 'group'; group: AdminNavGroup }

export const ADMIN_NAV: AdminNavEntry[] = [
  {
    type: 'link',
    labelKey: 'admin.nav.overview',
    href: '/dashboard/admin',
    icon: LayoutDashboard,
  },
  {
    type: 'group',
    group: {
      categoryKey: 'admin.nav.users',
      icon: Users,
      items: [
        { labelKey: 'admin.nav.accounts', href: '/dashboard/admin/users' },
        { labelKey: 'admin.nav.testerApplications', href: '/dashboard/admin/users/tester-applications' },
        { labelKey: 'admin.nav.subscriptions', href: '/dashboard/admin/users/subscriptions' },
        { labelKey: 'admin.nav.codes', href: '/dashboard/admin/users/codes' },
        { labelKey: 'admin.nav.security', href: '/dashboard/admin/security' },
      ],
    },
  },
  {
    type: 'group',
    group: {
      categoryKey: 'admin.nav.finance',
      icon: CreditCard,
      items: [
        { labelKey: 'admin.nav.payments', href: '/dashboard/admin/finance/payments' },
        { labelKey: 'admin.nav.modules', href: '/dashboard/admin/finance/module-prices' },
        { labelKey: 'admin.nav.campaigns', href: '/dashboard/admin/finance/campaigns' },
        { labelKey: 'admin.nav.promoBanners', href: '/dashboard/admin/finance/promo-banners' },
      ],
    },
  },
  {
    type: 'group',
    group: {
      categoryKey: 'admin.nav.content',
      icon: FileText,
      items: [
        { labelKey: 'admin.nav.carousel', href: '/dashboard/admin/content/carousel' },
        { labelKey: 'admin.nav.news', href: '/dashboard/admin/content/news' },
        { labelKey: 'admin.nav.medals', href: '/dashboard/admin/content/medals' },
      ],
    },
  },
  {
    type: 'group',
    group: {
      categoryKey: 'admin.nav.operations',
      icon: Flag,
      items: [
        { labelKey: 'admin.nav.featureFlags', href: '/dashboard/admin/operations/feature-flags' },
        { labelKey: 'admin.nav.activityHealth', href: '/dashboard/admin/operations/activity-health' },
      ],
    },
  },
  {
    type: 'group',
    group: {
      categoryKey: 'admin.nav.system',
      icon: Settings,
      items: [
        { labelKey: 'admin.nav.health', href: '/dashboard/admin/system/health' },
        { labelKey: 'admin.nav.scripts', href: '/dashboard/admin/system/scripts' },
        { labelKey: 'admin.nav.schedules', href: '/dashboard/admin/system/schedules' },
        { labelKey: 'admin.nav.logs', href: '/dashboard/admin/system/logs' },
      ],
    },
  },
]

export const ADMIN_BREADCRUMB_KEYS: Record<string, string> = {
  admin: 'admin.nav.breadcrumbAdmin',
  users: 'admin.nav.users',
  finance: 'admin.nav.finance',
  content: 'admin.nav.content',
  operations: 'admin.nav.operations',
  system: 'admin.nav.system',
  security: 'admin.nav.security',
  accounts: 'admin.nav.accounts',
  codes: 'admin.nav.codes',
  subscriptions: 'admin.nav.subscriptions',
  'tester-applications': 'admin.nav.testerApplications',
  payments: 'admin.nav.payments',
  'module-prices': 'admin.nav.modules',
  campaigns: 'admin.nav.campaigns',
  'promo-banners': 'admin.nav.promoBanners',
  carousel: 'admin.nav.carousel',
  news: 'admin.nav.news',
  medals: 'admin.nav.medals',
  'feature-flags': 'admin.nav.featureFlags',
  'activity-health': 'admin.nav.activityHealth',
  health: 'admin.nav.health',
  scripts: 'admin.nav.scripts',
  schedules: 'admin.nav.schedules',
  logs: 'admin.nav.logs',
}
