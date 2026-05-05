'use client'

import { AdminSidebar } from './AdminSidebar'
import { AdminHeader } from './AdminHeader'
import { AdminBreadcrumb } from '@/components/admin/shared/AdminBreadcrumb'

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-eve-background">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader />
        <div className="px-4 pt-2">
          <AdminBreadcrumb />
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
