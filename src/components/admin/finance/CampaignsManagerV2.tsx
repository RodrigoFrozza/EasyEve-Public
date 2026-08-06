'use client'

import { useState } from 'react'
import { Megaphone, Plus, Pencil, Trash2, Loader2, Save, Gift, Sparkles, Calendar, Target, Activity, Database, Shield, Layout } from 'lucide-react'
import { 
  useAdminPromoBanners, 
  useCreatePromoBanner, 
  useUpdatePromoBanner, 
  useDeletePromoBanner, 
  PromoBanner 
} from '@/lib/admin/hooks/useAdminPromoBanners'
import { AdminTable } from '@/components/admin/shared/AdminTable'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { cn } from '@/lib/utils'

const TARGET_SEGMENT_OPTIONS = [
  { value: 'NEW_NON_PREMIUM_USERS', label: 'NEW_NON_PREMIUM_ACCOUNTS' },
  { value: 'NEW_USERS', label: 'ALL_NEW_ACCOUNTS' },
  { value: 'NON_PREMIUM_USERS', label: 'ALL_NON_PREMIUM_ACCOUNTS' },
  { value: 'ALL_USERS', label: 'ALL_ACCOUNTS_GLOBAL' },
]

export function CampaignsManagerV2() {
  const { data: campaigns, isLoading } = useAdminPromoBanners()
  const createCampaign = useCreatePromoBanner()
  const updateCampaign = useUpdatePromoBanner()
  const deleteCampaign = useDeletePromoBanner()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Partial<PromoBanner> | null>(null)

  const handleOpenDialog = (item?: PromoBanner) => {
    if (item) {
      setEditingCampaign({
        ...item,
        startsAt: item.startsAt ? new Date(item.startsAt).toISOString().slice(0, 16) : '',
        endsAt: item.endsAt ? new Date(item.endsAt).toISOString().slice(0, 16) : '',
      })
    } else {
      setEditingCampaign({
        title: '',
        description: '',
        badgeText: 'NEW_ACCOUNT_REWARD',
        buttonText: 'GENERATE_7D_PREMIUM_CODE',
        targetSegment: 'NEW_NON_PREMIUM_USERS',
        maxAccountAgeDays: 7,
        priority: 100,
        dismissible: true,
        isActive: true,
        startsAt: '',
        endsAt: '',
      })
    }
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editingCampaign?.title || !editingCampaign?.description) {
      toast.error('VALID_TITLE_AND_DESC_REQUIRED')
      return
    }

    try {
      const payload = {
        ...editingCampaign,
        maxAccountAgeDays: Number(editingCampaign.maxAccountAgeDays),
        priority: Number(editingCampaign.priority),
        startsAt: editingCampaign.startsAt ? new Date(editingCampaign.startsAt).toISOString() : null,
        endsAt: editingCampaign.endsAt ? new Date(editingCampaign.endsAt).toISOString() : null,
      }

      if (editingCampaign.id) {
        await updateCampaign.mutateAsync(payload as PromoBanner & { id: string })
        toast.success('CAMPAIGN_DEFINITION_UPDATED')
      } else {
        await createCampaign.mutateAsync(payload)
        toast.success('NEW_CAMPAIGN_INITIALIZED')
      }
      setIsDialogOpen(false)
    } catch (error) {
      toast.error('COMMUNICATION_LINK_FAILURE')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('ABORT_CAMPAIGN_AND_PURGE_DATA?')) return
    try {
      await deleteCampaign.mutateAsync(id)
      toast.success('CAMPAIGN_PURGED')
    } catch (error) {
      toast.error('PURGE_SEQUENCE_FAILED')
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 font-mono space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-700" />
        <span className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] animate-pulse">QUERYING_ACTIVE_CAMPAIGNS...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-mono">
      <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-900 border border-zinc-800">
            <Target className="w-4 h-4 text-zinc-500" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-zinc-100 tracking-widest uppercase">PROMO_CAMPAIGN_REGISTRY</h2>
            <p className="text-[9px] text-zinc-600 uppercase tracking-tighter">SEGMENT_TARGETING_ACTIVE</p>
          </div>
        </div>
        <Button 
          onClick={() => handleOpenDialog()}
          className="bg-zinc-100 text-black hover:bg-zinc-300 rounded-none h-9 px-4 text-[10px] font-bold uppercase tracking-widest"
        >
          <Plus className="w-3.5 h-3.5 mr-2" />
          INIT_NEW_CAMPAIGN
        </Button>
      </div>

      <div className="bg-zinc-950 border border-zinc-900 overflow-hidden relative">
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-zinc-800" />
        
        <AdminTable
          data={campaigns || []}
          keyExtractor={(item) => item.id}
          columns={[
            {
              key: 'campaign',
              header: 'CAMPAIGN_IDENTIFIER',
              render: (item) => (
                <div className="flex flex-col py-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-zinc-200 uppercase tracking-tight">{item.title}</span>
                    {item.badgeText && (
                      <div className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 text-[8px] text-zinc-500 font-bold uppercase">
                        {item.badgeText}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-tighter mt-1 line-clamp-1 max-w-xs italic">
                    {item.description}
                  </span>
                </div>
              ),
            },
            {
              key: 'segment',
              header: 'TARGET_BLOCK',
              render: (item) => (
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {TARGET_SEGMENT_OPTIONS.find(o => o.value === item.targetSegment)?.label || item.targetSegment}
                </div>
              ),
            },
            {
              key: 'stats',
              header: 'CLAIM_METRICS',
              render: (item) => (
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="text-zinc-400 font-bold">{String(item.stats?.claimCount || 0).padStart(3, '0')}</span>
                  <span className="text-zinc-800">/</span>
                  <span className="text-zinc-600 font-bold">{String(item.stats?.redeemedCount || 0).padStart(3, '0')}</span>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'STATE',
              render: (item) => (
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-none",
                    item.isActive ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-zinc-800"
                  )} />
                  <span className={cn(
                    "text-[10px] font-black tracking-widest uppercase",
                    item.isActive ? "text-zinc-300" : "text-zinc-600"
                  )}>
                    {item.isActive ? 'ACTIVE' : 'STBY'}
                  </span>
                </div>
              ),
            },
            {
              key: 'actions',
              header: 'OPS',
              className: 'text-right',
              render: (item) => (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(item)}
                    className="h-8 w-8 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 rounded-none border border-transparent hover:border-zinc-800"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item.id)}
                    className="h-8 w-8 text-zinc-700 hover:text-red-500 hover:bg-red-950/20 rounded-none border border-transparent hover:border-red-900/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 sm:max-w-[700px] rounded-none font-mono max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader className="border-b border-zinc-900 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-[8px] text-zinc-500 font-bold tracking-[0.2em] uppercase">
                CAMPAIGN_CONFIG_v2
              </div>
            </div>
            <DialogTitle className="text-xs font-bold tracking-[0.2em] uppercase">
              {editingCampaign?.id ? `MODIFYING_CAMPAIGN::${editingCampaign.id.slice(0, 8)}` : 'INITIATING_NEW_PROMO_PROTOCOL'}
            </DialogTitle>
            <DialogDescription className="text-[9px] text-zinc-500 uppercase tracking-tighter">
              CONFIGURE_BANNER_SEGMENTATION_AND_REWARD_LOGIC
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6 pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">CAMPAIGN_IDENTIFIER</Label>
                <Input
                  id="title"
                  value={editingCampaign?.title || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-zinc-900 border-zinc-800 rounded-none text-xs h-10 uppercase tracking-wider focus-visible:ring-zinc-700"
                  placeholder="WELCOME_PROTOCOL"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="badge" className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">BADGE_LABEL</Label>
                <Input
                  id="badge"
                  value={editingCampaign?.badgeText || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, badgeText: e.target.value }))}
                  className="bg-zinc-900 border-zinc-800 rounded-none text-xs h-10 uppercase tracking-wider focus-visible:ring-zinc-700"
                  placeholder="NEW_RECRUIT"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">PROTOCOL_DESCRIPTION</Label>
              <Textarea
                id="description"
                value={editingCampaign?.description || ''}
                onChange={(e) => setEditingCampaign(prev => ({ ...prev, description: e.target.value }))}
                className="bg-zinc-900 border-zinc-800 rounded-none text-xs min-h-[80px] focus-visible:ring-zinc-700 resize-none"
                placeholder="DEFINE_USER_FACING_CAMPAIGN_GOALS..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buttonText" className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">CTA_LABEL</Label>
                <Input
                  id="buttonText"
                  value={editingCampaign?.buttonText || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, buttonText: e.target.value }))}
                  className="bg-zinc-900 border-zinc-800 rounded-none text-xs h-10 uppercase tracking-wider focus-visible:ring-zinc-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="segment" className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">TARGET_SEGMENTATION</Label>
                <Select
                  value={editingCampaign?.targetSegment}
                  onValueChange={(value) => setEditingCampaign(prev => ({ ...prev, targetSegment: value }))}
                >
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 rounded-none h-10 text-xs uppercase tracking-widest focus:ring-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 rounded-none">
                    {TARGET_SEGMENT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs uppercase tracking-widest focus:bg-zinc-900">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxAge" className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">MAX_ACC_AGE_DAYS</Label>
                <Input
                  id="maxAge"
                  type="number"
                  value={editingCampaign?.maxAccountAgeDays || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, maxAccountAgeDays: Number(e.target.value) }))}
                  className="bg-zinc-900 border-zinc-800 rounded-none text-xs h-10 focus-visible:ring-zinc-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">QUE_PRIORITY</Label>
                <Input
                  id="priority"
                  type="number"
                  value={editingCampaign?.priority || 0}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, priority: Number(e.target.value) }))}
                  className="bg-zinc-900 border-zinc-800 rounded-none text-xs h-10 focus-visible:ring-zinc-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imageUrl" className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">ASSET_URI_OPT</Label>
                <Input
                  id="imageUrl"
                  value={editingCampaign?.imageUrl || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, imageUrl: e.target.value }))}
                  className="bg-zinc-900 border-zinc-800 rounded-none text-xs h-10 focus-visible:ring-zinc-700"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startsAt" className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">ACTIVATION_STAMP</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={editingCampaign?.startsAt || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, startsAt: e.target.value }))}
                  className="bg-zinc-900 border-zinc-800 rounded-none text-xs h-10 focus-visible:ring-zinc-700 invert-calendar-icon"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsAt" className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">EXPIRATION_STAMP</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={editingCampaign?.endsAt || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, endsAt: e.target.value }))}
                  className="bg-zinc-900 border-zinc-800 rounded-none text-xs h-10 focus-visible:ring-zinc-700 invert-calendar-icon"
                />
              </div>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-900 group">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive" className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">OPERATIONAL_STATE</Label>
                  <p className="text-[8px] text-zinc-600 uppercase">BROADCAST_VISIBILITY_TOGGLE</p>
                </div>
                <Switch
                  id="isActive"
                  checked={editingCampaign?.isActive ?? true}
                  onCheckedChange={(checked) => setEditingCampaign(prev => ({ ...prev, isActive: checked }))}
                  className="data-[state=checked]:bg-zinc-200 data-[state=unchecked]:bg-zinc-800"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-900 group">
                <div className="space-y-0.5">
                  <Label htmlFor="dismissible" className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">USER_ABORT_ALLOWED</Label>
                  <p className="text-[8px] text-zinc-600 uppercase">ALLOW_CLIENT_TO_DISSIMISS_BANNER</p>
                </div>
                <Switch
                  id="dismissible"
                  checked={editingCampaign?.dismissible ?? true}
                  onCheckedChange={(checked) => setEditingCampaign(prev => ({ ...prev, dismissible: checked }))}
                  className="data-[state=checked]:bg-zinc-200 data-[state=unchecked]:bg-zinc-800"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-zinc-900 pt-4 gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setIsDialogOpen(false)} 
              className="text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 rounded-none text-[10px] font-bold uppercase tracking-widest"
            >
              ABORT_CHANGES
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={createCampaign.isPending || updateCampaign.isPending}
              className="bg-zinc-100 text-black hover:bg-zinc-300 rounded-none text-[10px] font-bold uppercase tracking-widest px-8"
            >
              {(createCampaign.isPending || updateCampaign.isPending) ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-2" />
              )}
              COMMIT_PROTOCOL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
