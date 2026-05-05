'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function AdminHeader() {
  const pathname = usePathname()
  
  const getPageTitle = () => {
    const segments = pathname.split('/').filter(Boolean)
    const adminIndex = segments.indexOf('admin')
    if (adminIndex === -1) return 'Dashboard'
    const section = segments[adminIndex + 1]
    return section ? section.charAt(0).toUpperCase() + section.slice(1) : 'Dashboard'
  }

  return (
    <header className="bg-eve-panel/80 backdrop-blur-md border-b border-eve-border/40 p-4">
      <h1 className="text-xl font-bold text-eve-text">
        {getPageTitle()}
      </h1>
    </header>
  )
}
