import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PaymentsManagerV2 } from '@/components/admin/finance/PaymentsManagerV2'
import { PlatformModulesManagerV2 } from '@/components/admin/finance/ModulePricesManagerV2'
import { PromoBannersManagerV2 } from '@/components/admin/finance/PromoBannersManagerV2'
import { CampaignsManagerV2 } from '@/components/admin/finance/CampaignsManagerV2'

export default function AdminFinancePage() {
  return (
          <AdminPageContainer 
        title="Finance"
        description="Manage payments, subscriptions, and campaigns"
      >
        <Tabs defaultValue="payments" className="space-y-4">
          <TabsList className="bg-eve-panel/40 border border-eve-border/30">
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="banners">Promo Banners</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          </TabsList>

          <TabsContent value="payments">
            <PaymentsManagerV2 />
          </TabsContent>

          <TabsContent value="modules">
            <PlatformModulesManagerV2 />
          </TabsContent>

          <TabsContent value="banners">
            <PromoBannersManagerV2 />
          </TabsContent>

          <TabsContent value="campaigns">
            <CampaignsManagerV2 />
          </TabsContent>
        </Tabs>
      </AdminPageContainer>
  )
}

