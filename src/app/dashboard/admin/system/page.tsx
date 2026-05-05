'use client'

import { Suspense, useState } from 'react'
import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HealthMonitorV2 } from '@/components/admin/system/HealthMonitorV2'
import { ScriptManagerV2 } from '@/components/admin/system/ScriptManagerV2'
import { GlobalLogsV2 } from '@/components/admin/system/GlobalLogsV2'
import { SchedulesDashboard } from '@/components/admin/system/SchedulesDashboard'

export default function AdminSystemPage() {
  const [activeTab, setActiveTab] = useState('health')

  return (
          <AdminPageContainer 
        title="System"
        description="Monitor system health and manage scripts"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-eve-panel/40 border border-eve-border/30">
            <TabsTrigger value="health">Health Monitor</TabsTrigger>
            <TabsTrigger value="scripts">Scripts</TabsTrigger>
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
            <TabsTrigger value="logs">Global Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="health">
            <HealthMonitorV2 />
          </TabsContent>

          <TabsContent value="scripts">
            <ScriptManagerV2 onGoToSchedules={() => setActiveTab('schedules')} />
          </TabsContent>

          <TabsContent value="schedules">
            <Suspense fallback={<div className="h-40 bg-eve-panel/60 animate-pulse rounded-lg" />}>
              <SchedulesDashboard />
            </Suspense>
          </TabsContent>

          <TabsContent value="logs">
            <GlobalLogsV2 />
          </TabsContent>
        </Tabs>
      </AdminPageContainer>
  )
}

