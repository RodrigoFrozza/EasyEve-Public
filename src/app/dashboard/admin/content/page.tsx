import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CarouselManagerV2 } from '@/components/admin/content/CarouselManagerV2'
import { NewsManagerV2 } from '@/components/admin/content/NewsManagerV2'
import { MedalManagerV2 } from '@/components/admin/content/MedalManagerV2'

export default function AdminContentManagementPage() {
  return (
          <AdminPageContainer 
        title="Content"
        description="Manage site content, news, and media"
      >
        <Tabs defaultValue="carousel" className="space-y-4">
          <TabsList className="bg-eve-panel/40 border border-eve-border/30">
            <TabsTrigger value="carousel">Carousel</TabsTrigger>
            <TabsTrigger value="news">News</TabsTrigger>
            <TabsTrigger value="medals">Medals</TabsTrigger>
          </TabsList>

          <TabsContent value="carousel">
            <CarouselManagerV2 />
          </TabsContent>

          <TabsContent value="news">
            <NewsManagerV2 />
          </TabsContent>

          <TabsContent value="medals">
            <MedalManagerV2 />
          </TabsContent>
        </Tabs>
      </AdminPageContainer>
  )
}

