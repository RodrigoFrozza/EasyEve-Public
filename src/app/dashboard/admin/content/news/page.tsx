import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { NewsManagerV2 } from '@/components/admin/content/NewsManagerV2'
import { Newspaper } from 'lucide-react'

export default function AdminNewsPage() {
  return (
          <AdminPageContainer 
        title="News"
        description="Manage site news and announcements"
      >
        <NewsManagerV2 />
      </AdminPageContainer>
  )
}

