'use client'

import { useState } from 'react'
import { Megaphone, Plus, Pencil, Trash2, Loader2, Save, Gift, Sparkles, Calendar } from 'lucide-react'
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
  { value: 'NEW_NON_PREMIUM_USERS', label: 'New non-premium accounts' },
  { value: 'NEW_USERS', label: 'All new accounts' },
  { value: 'NON_PREMIUM_USERS', label: 'All non-premium accounts' },
  { value: 'ALL_USERS', label: 'All accounts' },
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
        badgeText: 'New account reward',
        buttonText: 'Generate 7-day premium code',
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
      toast.error('Title and description are required')
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
        toast.success('Campaign updated')
      } else {
        await createCampaign.mutateAsync(payload)
        toast.success('Campaign created')
      }
      setIsDialogOpen(false)
    } catch (error) {
      toast.error('Failed to save campaign')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return
    try {
      await deleteCampaign.mutateAsync(id)
      toast.success('Campaign deleted')
    } catch (error) {
      toast.error('Failed to delete campaign')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-eve-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button 
          onClick={() => handleOpenDialog()}
          className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      <div className="bg-eve-panel/60 border border-eve-border/30 rounded-xl overflow-hidden">
        <AdminTable
          data={campaigns || []}
          keyExtractor={(item) => item.id}
          columns={[
            {
              key: 'campaign',
              header: 'Campaign',
              render: (item) => (
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-eve-text">{item.title}</span>
                    {item.badgeText && (
                      <AdminBadge status="info" className="text-[10px] h-4">
                        {item.badgeText}
                      </AdminBadge>
                    )}
                  </div>
                  <span className="text-xs text-eve-text/40 line-clamp-1 max-w-xs">
                    {item.description}
                  </span>
                </div>
              ),
            },
            {
              key: 'segment',
              header: 'Target',
              render: (item) => (
                <div className="text-xs text-eve-text/60">
                  {TARGET_SEGMENT_OPTIONS.find(o => o.value === item.targetSegment)?.label || item.targetSegment}
                </div>
              ),
            },
            {
              key: 'stats',
              header: 'Stats (Claimed/Used)',
              render: (item) => (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-cyan-400 font-bold">{item.stats?.claimCount || 0}</span>
                  <span className="text-eve-text/20">/</span>
                  <span className="text-green-400 font-bold">{item.stats?.redeemedCount || 0}</span>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (item) => (
                <AdminBadge status={item.isActive ? 'success' : 'default'}>
                  {item.isActive ? 'Active' : 'Inactive'}
                </AdminBadge>
              ),
            },
            {
              key: 'actions',
              header: '',
              className: 'text-right',
              render: (item) => (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(item)}
                    className="text-eve-text/60 hover:text-eve-accent hover:bg-eve-accent/10"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-eve-text/60 hover:text-red-400 hover:bg-red-400/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-eve-panel border-eve-border text-eve-text sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCampaign?.id ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle>
            <DialogDescription className="text-eve-text/60">
              Configure the promo banner campaign settings.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Campaign Title</Label>
                <Input
                  id="title"
                  value={editingCampaign?.title || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-eve-background/50 border-eve-border/30"
                  placeholder="Welcome Reward"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="badge">Badge Text</Label>
                <Input
                  id="badge"
                  value={editingCampaign?.badgeText || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, badgeText: e.target.value }))}
                  className="bg-eve-background/50 border-eve-border/30"
                  placeholder="Starter reward"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editingCampaign?.description || ''}
                onChange={(e) => setEditingCampaign(prev => ({ ...prev, description: e.target.value }))}
                className="bg-eve-background/50 border-eve-border/30 min-h-[80px]"
                placeholder="Give new accounts a 7-day premium trial."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="buttonText">Button Text</Label>
                <Input
                  id="buttonText"
                  value={editingCampaign?.buttonText || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, buttonText: e.target.value }))}
                  className="bg-eve-background/50 border-eve-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="segment">Target Segment</Label>
                <Select
                  value={editingCampaign?.targetSegment}
                  onValueChange={(value) => setEditingCampaign(prev => ({ ...prev, targetSegment: value }))}
                >
                  <SelectTrigger className="bg-eve-background/50 border-eve-border/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-eve-panel border-eve-border">
                    {TARGET_SEGMENT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="maxAge">Max Acc Age (days)</Label>
                <Input
                  id="maxAge"
                  type="number"
                  value={editingCampaign?.maxAccountAgeDays || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, maxAccountAgeDays: Number(e.target.value) }))}
                  className="bg-eve-background/50 border-eve-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority (0-999)</Label>
                <Input
                  id="priority"
                  type="number"
                  value={editingCampaign?.priority || 0}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, priority: Number(e.target.value) }))}
                  className="bg-eve-background/50 border-eve-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="imageUrl">Image URL (optional)</Label>
                <Input
                  id="imageUrl"
                  value={editingCampaign?.imageUrl || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, imageUrl: e.target.value }))}
                  className="bg-eve-background/50 border-eve-border/30"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startsAt">Starts At</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={editingCampaign?.startsAt || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, startsAt: e.target.value }))}
                  className="bg-eve-background/50 border-eve-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endsAt">Ends At</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={editingCampaign?.endsAt || ''}
                  onChange={(e) => setEditingCampaign(prev => ({ ...prev, endsAt: e.target.value }))}
                  className="bg-eve-background/50 border-eve-border/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-eve-border/30 bg-eve-background/20">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active Campaign</Label>
                <p className="text-xs text-eve-text/40">Visible to eligible users</p>
              </div>
              <Switch
                id="isActive"
                checked={editingCampaign?.isActive ?? true}
                onCheckedChange={(checked) => setEditingCampaign(prev => ({ ...prev, isActive: checked }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-eve-border/30 bg-eve-background/20">
              <div className="space-y-0.5">
                <Label htmlFor="dismissible">User can dismiss</Label>
                <p className="text-xs text-eve-text/40">Allows users to hide this banner</p>
              </div>
              <Switch
                id="dismissible"
                checked={editingCampaign?.dismissible ?? true}
                onCheckedChange={(checked) => setEditingCampaign(prev => ({ ...prev, dismissible: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-eve-border">
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={createCampaign.isPending || updateCampaign.isPending}
              className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold"
            >
              {(createCampaign.isPending || updateCampaign.isPending) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
