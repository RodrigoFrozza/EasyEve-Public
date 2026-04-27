import { AdminContent } from '@/components/admin/AdminContent'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Dashboard | EasyEve',
  description: 'Management and administration panel for EasyEve.',
}

export default function AdminPage() {
  return (
    <div className="container mx-auto py-8 overflow-y-auto">
      <AdminContent />
    </div>
  )
}