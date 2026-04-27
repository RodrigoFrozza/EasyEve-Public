'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { 
  Megaphone, 
  Plus, 
  RefreshCw, 
  Settings2, 
  Sparkles, 
  Target
} from 'lucide-react'
import { CampaignList } from './CampaignList'
import { CampaignForm } from './CampaignForm'
import { CampaignPreview } from './CampaignPreview'
import { cn } from '@/lib/utils'

export function CampaignManager() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null)
  
  // Real-time preview state for the form
  const [previewData, setPreviewData] = useState<any>(null)

  const fetchCampaigns = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/promo-banners')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load campaigns')
      setCampaigns(data.items || [])
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const handleCreate = () => {
    setSelectedCampaign(null)
    setPreviewData(null)
    setView('create')
  }

  const handleEdit = (campaign: any) => {
    setSelectedCampaign(campaign)
    setPreviewData(campaign)
    setView('edit')
  }

  const handleSubmit = async (formData: any) => {
    setSubmitting(true)
    try {
      const url = selectedCampaign 
        ? `/api/admin/promo-banners/${selectedCampaign.id}` 
        : '/api/admin/promo-banners'
      
      const response = await fetch(url, {
        method: selectedCampaign ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save campaign')

      toast.success(selectedCampaign ? 'Campaign updated' : 'Campaign launched successfully!')
      setView('list')
      fetchCampaigns()
    } catch (error) {
      console.error('Failed to save campaign:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save campaign')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to archive this campaign? It will be permanently removed from users\' view.')) return
    
    try {
      const response = await fetch(`/api/admin/promo-banners/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete campaign')
      toast.success('Campaign archived')
      fetchCampaigns()
    } catch (error) {
      toast.error('Failed to delete campaign')
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-2xl bg-eve-accent/10 border border-eve-accent/20 flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-eve-accent" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight font-outfit">
              Campaign Manager
            </h2>
          </div>
          <p className="text-sm text-gray-500 font-medium">
            Drive engagement with targeted banners, modals, and rewards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {view === 'list' ? (
            <>
              <Button
                variant="outline"
                className="border-eve-border text-gray-400 hover:text-white rounded-xl h-12 px-6"
                onClick={fetchCampaigns}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button
                className="bg-eve-accent text-black hover:bg-eve-accent/80 font-black uppercase tracking-widest rounded-xl h-12 px-8 shadow-lg shadow-eve-accent/10"
                onClick={handleCreate}
              >
                <Plus className="h-5 w-5 mr-2" />
                New Campaign
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              className="text-gray-400 hover:text-white rounded-xl h-12 px-6"
              onClick={() => setView('list')}
            >
              Back to Overview
            </Button>
          )}
        </div>
      </div>

      {view === 'list' ? (
        <div className="space-y-6">
          {/* Stats Overview (Placeholders for now) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Active Campaigns', value: campaigns.filter((c: any) => c.isActive).length, icon: Play, color: 'text-emerald-400' },
              { label: 'Total Engagements', value: campaigns.reduce((acc, c: any) => acc + (c.stats?.claimCount || 0), 0), icon: Target, color: 'text-cyan-400' },
              { label: 'Conversion Rate', value: '12.5%', icon: Sparkles, color: 'text-purple-400' },
              { label: 'Rules Evaluated', value: '1.2k', icon: Settings2, color: 'text-amber-400' },
            ].map((stat, i) => (
              <Card key={i} className="bg-eve-panel border-eve-border shadow-xl">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className={cn("h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center", stat.color)}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</p>
                    <p className="text-xl font-black text-white">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <CampaignList 
            campaigns={campaigns} 
            loading={loading} 
            onEdit={handleEdit} 
            onDelete={handleDelete} 
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <Card className="lg:col-span-7 bg-eve-panel border-eve-border shadow-2xl rounded-[32px] overflow-hidden">
            <CardHeader className="border-b border-eve-border/50 bg-black/20 p-8">
              <CardTitle className="text-xl font-black text-white uppercase font-outfit">
                {view === 'create' ? 'Configure New Campaign' : 'Edit Campaign Strategy'}
              </CardTitle>
              <CardDescription className="text-gray-500 font-medium">
                Set up your visuals, actions, and targeting rules below.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <CampaignForm 
                initialData={selectedCampaign} 
                submitting={submitting} 
                onSubmit={handleSubmit}
                onCancel={() => setView('list')}
              />
            </CardContent>
          </Card>

          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-8">
            <CampaignPreview data={previewData || {}} />
            
            <Card className="bg-eve-dark/40 border-eve-border/50 border-dashed rounded-3xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Settings2 className="h-5 w-5 text-gray-500" />
                  <h4 className="text-sm font-bold text-white uppercase tracking-widest">Targeting Intelligence</h4>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  The system automatically prioritizes campaigns with higher priority scores. 
                  Users will only see one campaign at a time to prevent dashboard clutter.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function Play(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}
