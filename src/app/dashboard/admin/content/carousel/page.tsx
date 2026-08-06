import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { CarouselManagerV2 } from '@/components/admin/content/CarouselManagerV2'
import { Image } from 'lucide-react'

export default function AdminCarouselPage() {
  return (
          <AdminPageContainer 
        title="Carousel"
        description="Manage homepage carousel items"
      >
        <CarouselManagerV2 />
      </AdminPageContainer>
  )
}

