'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Users, CreditCard, FileText, Settings,
  ChevronDown, ChevronRight 
} from 'lucide-react'
import { cn } from '@/lib/utils'

const adminNav = [
  {
    category: 'Users',
    icon: Users,
    items: [
      { label: 'Accounts', href: '/dashboard/admin/users' },
      { label: 'Tester Applications', href: '/dashboard/admin/users/tester-applications' },
      { label: 'Subscriptions', href: '/dashboard/admin/users/subscriptions' },
      { label: 'Codes', href: '/dashboard/admin/users/codes' },
      { label: 'Security', href: '/dashboard/admin/security' },
    ]
  },
  {
    category: 'Finance',
    icon: CreditCard,
    items: [
      { label: 'Payments', href: '/dashboard/admin/finance/payments' },
      { label: 'Modules', href: '/dashboard/admin/finance/module-prices' },
      { label: 'Campaigns', href: '/dashboard/admin/finance/campaigns' },
      { label: 'Promo Banners', href: '/dashboard/admin/finance/promo-banners' },
    ]
  },
  {
    category: 'Content',
    icon: FileText,
    items: [
      { label: 'Carousel', href: '/dashboard/admin/content/carousel' },
      { label: 'News', href: '/dashboard/admin/content/news' },
      { label: 'Medals', href: '/dashboard/admin/content/medals' },
    ]
  },
  {
    category: 'System',
    icon: Settings,
    items: [
      { label: 'Health', href: '/dashboard/admin/system/health' },
      { label: 'Scripts', href: '/dashboard/admin/system/scripts' },
      { label: 'Scheduled Jobs', href: '/dashboard/admin/system/schedules' },
      { label: 'Logs', href: '/dashboard/admin/system/logs' },
    ]
  }
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [openCategories, setOpenCategories] = useState<string[]>(['Users'])

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    )
  }

  return (
    <aside className="w-64 bg-eve-panel/80 backdrop-blur-md border-r border-eve-border/40 h-screen flex flex-col">
      <div className="p-4 border-b border-eve-border/40">
        <h2 className="text-lg font-bold text-eve-accent tracking-wider uppercase">
          Admin Panel
        </h2>
      </div>
      
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {adminNav.map((section) => {
          const isOpen = openCategories.includes(section.category)
          const Icon = section.icon
          
          return (
            <div key={section.category} className="space-y-1">
              <button
                onClick={() => toggleCategory(section.category)}
                className="w-full flex items-center justify-between p-2 rounded-md hover:bg-eve-accent/10 text-sm font-medium text-eve-text/80 hover:text-eve-accent transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{section.category}</span>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              {isOpen && (
                <div className="ml-6 space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'block p-2 rounded-md text-sm transition-colors',
                          isActive 
                            ? 'bg-eve-accent/20 text-eve-accent' 
                            : 'text-eve-text/60 hover:bg-eve-accent/10 hover:text-eve-text'
                        )}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
