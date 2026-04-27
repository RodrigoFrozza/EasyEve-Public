'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CAMPAIGN_TYPES,
  CAMPAIGN_ACTIONS,
  PROMO_BANNER_SEGMENTS,
} from '@/lib/promo-banners'
import { Gift, Globe, Layout, Link as LinkIcon, Loader2, Megaphone, MessageSquare, MousePointer2, Sparkles, Target, Calendar } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface CampaignFormProps {
  initialData?: any
  onSubmit: (data: any) => Promise<void>
  submitting: boolean
  onCancel?: () => void
}

export function CampaignForm({ initialData, onSubmit, submitting, onCancel }: CampaignFormProps) {
  const [form, setForm] = useState(initialData || {
    title: '',
    description: '',
    badgeText: 'Limited Offer',
    buttonText: 'Claim Reward',
    imageUrl: '',
    type: CAMPAIGN_TYPES.BANNER,
    actionType: CAMPAIGN_ACTIONS.CLAIM_CODE,
    actionConfig: {},
    targetingRules: {},
    targetSegment: PROMO_BANNER_SEGMENTS.NEW_NON_PREMIUM_USERS,
    maxAccountAgeDays: '7',
    priority: '100',
    dismissible: true,
    isActive: true,
    startsAt: '',
    endsAt: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  const updateField = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }))
  }

  const updateActionConfig = (key: string, value: any) => {
    setForm((prev: any) => ({
      ...prev,
      actionConfig: { ...prev.actionConfig, [key]: value }
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="visuals" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-eve-dark/50 border border-eve-border/30 mb-6">
          <TabsTrigger value="visuals" className="data-[state=active]:bg-eve-accent data-[state=active]:text-black">
            <Layout className="h-4 w-4 mr-2" />
            Visuals
          </TabsTrigger>
          <TabsTrigger value="action" className="data-[state=active]:bg-eve-accent data-[state=active]:text-black">
            <MousePointer2 className="h-4 w-4 mr-2" />
            Action
          </TabsTrigger>
          <TabsTrigger value="targeting" className="data-[state=active]:bg-eve-accent data-[state=active]:text-black">
            <Target className="h-4 w-4 mr-2" />
            Targeting
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visuals" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 bg-eve-panel/20 p-6 rounded-2xl border border-eve-border/20">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title" className="text-xs uppercase tracking-widest text-gray-400">Campaign Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="bg-eve-dark border-eve-border"
                  placeholder="e.g. Welcome Pilot!"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="badge" className="text-xs uppercase tracking-widest text-gray-400">Badge Text</Label>
                <Input
                  id="badge"
                  value={form.badgeText}
                  onChange={(e) => updateField('badgeText', e.target.value)}
                  className="bg-eve-dark border-eve-border"
                  placeholder="e.g. Special Reward"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description" className="text-xs uppercase tracking-widest text-gray-400">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="bg-eve-dark border-eve-border min-h-[100px]"
                  placeholder="Describe what the user gets or needs to do..."
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-widest text-gray-400">Visual Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(CAMPAIGN_TYPES).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={form.type === type ? 'default' : 'outline'}
                      className={form.type === type ? 'bg-eve-accent text-black hover:bg-eve-accent/90' : 'border-eve-border'}
                      onClick={() => updateField('type', type)}
                    >
                      {type === 'BANNER' && <Layout className="h-4 w-4 mr-2" />}
                      {type === 'POPUP' && <MessageSquare className="h-4 w-4 mr-2" />}
                      {type === 'TOAST' && <Megaphone className="h-4 w-4 mr-2" />}
                      <span className="hidden sm:inline">{type}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="imageUrl" className="text-xs uppercase tracking-widest text-gray-400">Image URL (Optional)</Label>
                <Input
                  id="imageUrl"
                  value={form.imageUrl}
                  onChange={(e) => updateField('imageUrl', e.target.value)}
                  className="bg-eve-dark border-eve-border"
                  placeholder="https://..."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="priority" className="text-xs uppercase tracking-widest text-gray-400">Display Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={form.priority}
                  onChange={(e) => updateField('priority', e.target.value)}
                  className="bg-eve-dark border-eve-border"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="action" className="space-y-6">
          <div className="bg-eve-panel/20 p-6 rounded-2xl border border-eve-border/20 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-widest text-gray-400">Action Type</Label>
                <Select
                  value={form.actionType}
                  onValueChange={(value) => updateField('actionType', value)}
                >
                  <SelectTrigger className="bg-eve-dark border-eve-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-eve-panel border-eve-border">
                    <SelectItem value={CAMPAIGN_ACTIONS.CLAIM_CODE}>
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4 text-pink-400" />
                        Claim Reward (Promo Code)
                      </div>
                    </SelectItem>
                    <SelectItem value={CAMPAIGN_ACTIONS.REDIRECT}>
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4 text-blue-400" />
                        Internal Redirect
                      </div>
                    </SelectItem>
                    <SelectItem value={CAMPAIGN_ACTIONS.EXTERNAL_LINK}>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-green-400" />
                        External Link
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="buttonText" className="text-xs uppercase tracking-widest text-gray-400">Button Text</Label>
                <Input
                  id="buttonText"
                  value={form.buttonText}
                  onChange={(e) => updateField('buttonText', e.target.value)}
                  className="bg-eve-dark border-eve-border"
                  required
                />
              </div>
            </div>

            <div className="rounded-xl bg-eve-dark/30 border border-eve-border p-6">
              {form.actionType === CAMPAIGN_ACTIONS.CLAIM_CODE && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400 flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-eve-accent" />
                    The user will receive a personal activation code upon clicking.
                  </p>
                  <div className="grid gap-2">
                    <Label className="text-xs uppercase tracking-widest text-gray-400">Code Type</Label>
                    <Select
                      value={form.actionConfig?.codeType || 'DAYS_7'}
                      onValueChange={(value) => updateActionConfig('codeType', value)}
                    >
                      <SelectTrigger className="bg-eve-dark border-eve-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-eve-panel border-eve-border">
                        <SelectItem value="DAYS_7">7 Days Premium</SelectItem>
                        <SelectItem value="DAYS_30">30 Days Premium</SelectItem>
                        <SelectItem value="DAYS_90">90 Days Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {(form.actionType === CAMPAIGN_ACTIONS.REDIRECT || form.actionType === CAMPAIGN_ACTIONS.EXTERNAL_LINK) && (
                <div className="grid gap-2">
                  <Label className="text-xs uppercase tracking-widest text-gray-400">Target URL</Label>
                  <div className="relative">
                    <Input
                      value={form.actionConfig?.url || ''}
                      onChange={(e) => updateActionConfig('url', e.target.value)}
                      className="bg-eve-dark border-eve-border pl-10"
                      placeholder={form.actionType === CAMPAIGN_ACTIONS.REDIRECT ? '/dashboard/market' : 'https://...'}
                      required
                    />
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="targeting" className="space-y-6">
          <div className="bg-eve-panel/20 p-6 rounded-2xl border border-eve-border/20 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label className="text-xs uppercase tracking-widest text-gray-400">User Segment</Label>
                  <Select
                    value={form.targetSegment}
                    onValueChange={(value) => updateField('targetSegment', value)}
                  >
                    <SelectTrigger className="bg-eve-dark border-eve-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-eve-panel border-eve-border">
                      {Object.entries(PROMO_BANNER_SEGMENTS).map(([key, value]) => (
                        <SelectItem key={value} value={value}>
                          {key.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(form.targetSegment.includes('NEW')) && (
                  <div className="grid gap-2">
                    <Label htmlFor="max-age" className="text-xs uppercase tracking-widest text-gray-400">Max Account Age (Days)</Label>
                    <Input
                      id="max-age"
                      type="number"
                      value={form.maxAccountAgeDays}
                      onChange={(e) => updateField('maxAccountAgeDays', e.target.value)}
                      className="bg-eve-dark border-eve-border"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="startsAt" className="text-xs uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    Starts At
                  </Label>
                  <Input
                    id="startsAt"
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => updateField('startsAt', e.target.value)}
                    className="bg-eve-dark border-eve-border"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endsAt" className="text-xs uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    Ends At
                  </Label>
                  <Input
                    id="endsAt"
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => updateField('endsAt', e.target.value)}
                    className="bg-eve-dark border-eve-border"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between pt-4 border-t border-eve-border/50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) => updateField('isActive', checked)}
            />
            <Label className="text-xs">Active</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.dismissible}
              onCheckedChange={(checked) => updateField('dismissible', checked)}
            />
            <Label className="text-xs">Dismissible</Label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="text-gray-400"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={submitting}
            className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold px-8"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {initialData ? 'Update Campaign' : 'Launch Campaign'}
          </Button>
        </div>
      </div>
    </form>
  )
}
