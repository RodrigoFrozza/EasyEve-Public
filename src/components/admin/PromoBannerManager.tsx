'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Calendar,
  Gift,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { handleAdminError } from '@/lib/admin/error-handler'

interface PromoBannerStats {
  claimCount: number
  dismissCount: number
  redeemedCount: number
}

interface PromoBannerRecord {
  id: string
  title: string
  description: string
  badgeText: string | null
  buttonText: string
  targetSegment: string
  maxAccountAgeDays: number | null
  priority: number
  dismissible: boolean
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
  stats: PromoBannerStats
}

interface PromoBannerFormState {
  title: string
  description: string
  badgeText: string
  buttonText: string
  targetSegment: string
  maxAccountAgeDays: string
  priority: string
  dismissible: boolean
  isActive: boolean
  startsAt: string
  endsAt: string
}

const TARGET_SEGMENT_OPTIONS = [
  { value: 'NEW_NON_PREMIUM_USERS', label: 'New non-premium accounts' },
  { value: 'NEW_USERS', label: 'All new accounts' },
  { value: 'NON_PREMIUM_USERS', label: 'All non-premium accounts' },
  { value: 'ALL_USERS', label: 'All accounts' },
]

const DEFAULT_FORM_STATE: PromoBannerFormState = {
  title: '',
  description: '',
  badgeText: 'New account reward',
  buttonText: 'Generate 7-day premium code',
  targetSegment: 'NEW_NON_PREMIUM_USERS',
  maxAccountAgeDays: '7',
  priority: '100',
  dismissible: true,
  isActive: true,
  startsAt: '',
  endsAt: '',
}

function toDateTimeLocalValue(value: string | null): string {
  if (!value) return ''

  const date = new Date(value)
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  const localDate = new Date(date.getTime() - timezoneOffset)

  return localDate.toISOString().slice(0, 16)
}

function getTargetSegmentLabel(segment: string): string {
  return TARGET_SEGMENT_OPTIONS.find((option) => option.value === segment)?.label || segment
}

function getBannerRuleSummary(banner: PromoBannerRecord): string {
  if (
    banner.targetSegment === 'NEW_USERS' ||
    banner.targetSegment === 'NEW_NON_PREMIUM_USERS'
  ) {
    const maxAgeDays = banner.maxAccountAgeDays ?? 7
    return `${getTargetSegmentLabel(banner.targetSegment)} up to ${maxAgeDays} days old`
  }

  return getTargetSegmentLabel(banner.targetSegment)
}

function getPayloadFromForm(form: PromoBannerFormState) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    badgeText: form.badgeText.trim() || null,
    buttonText: form.buttonText.trim(),
    targetSegment: form.targetSegment,
    maxAccountAgeDays: form.maxAccountAgeDays.trim()
      ? Number(form.maxAccountAgeDays)
      : null,
    priority: Number(form.priority),
    dismissible: form.dismissible,
    isActive: form.isActive,
    startsAt: form.startsAt || null,
    endsAt: form.endsAt || null,
  }
}

export function PromoBannerManager() {
  const [banners, setBanners] = useState<PromoBannerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedBannerId, setSelectedBannerId] = useState<string | null>(null)
  const [form, setForm] = useState<PromoBannerFormState>(DEFAULT_FORM_STATE)

  const isEditing = selectedBannerId !== null

  const fetchBanners = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/admin/promo-banners')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load promo banners')
      }

      setBanners(data.items || [])
    } catch (error) {
      handleAdminError(error, 'Failed to load promo banners')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBanners()
  }, [])

  function resetForm() {
    setForm(DEFAULT_FORM_STATE)
    setSelectedBannerId(null)
  }

  function loadBannerIntoForm(banner: PromoBannerRecord) {
    setSelectedBannerId(banner.id)
    setForm({
      title: banner.title,
      description: banner.description,
      badgeText: banner.badgeText || '',
      buttonText: banner.buttonText,
      targetSegment: banner.targetSegment,
      maxAccountAgeDays: banner.maxAccountAgeDays?.toString() || '',
      priority: banner.priority.toString(),
      dismissible: banner.dismissible,
      isActive: banner.isActive,
      startsAt: toDateTimeLocalValue(banner.startsAt),
      endsAt: toDateTimeLocalValue(banner.endsAt),
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    try {
      const payload = getPayloadFromForm(form)
      const response = await fetch(
        isEditing ? `/api/admin/promo-banners/${selectedBannerId}` : '/api/admin/promo-banners',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save promo banner')
      }

      toast.success(isEditing ? 'Promo banner updated' : 'Promo banner created')
      resetForm()
      fetchBanners()
    } catch (error) {
      handleAdminError(error, 'Failed to save promo banner')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(bannerId: string) {
    if (!window.confirm('Delete this promo banner?')) return

    try {
      const response = await fetch(`/api/admin/promo-banners/${bannerId}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete promo banner')
      }

      toast.success('Promo banner deleted')

      if (selectedBannerId === bannerId) {
        resetForm()
      }

      fetchBanners()
    } catch (error) {
      handleAdminError(error, 'Failed to delete promo banner')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-eve-accent" />
            Promo Banner Campaigns
          </h2>
          <p className="text-xs text-gray-500">
            Create onboarding campaigns that issue one personal 7-day premium code per account.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-eve-border text-gray-300 hover:text-white"
            onClick={fetchBanners}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold"
            onClick={resetForm}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Banner
          </Button>
        </div>
      </div>

      <Card className="bg-eve-panel border-eve-border shadow-2xl">
        <CardHeader>
          <CardTitle className="text-lg text-white">
            {isEditing ? 'Edit promo banner' : 'Create promo banner'}
          </CardTitle>
          <CardDescription>
            Banner text is fully editable. The reward is fixed to a 7-day premium activation code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="promo-title">Title</Label>
                <Input
                  id="promo-title"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="bg-eve-dark border-eve-border"
                  placeholder="Welcome to EasyEve"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="promo-badge">Badge Text</Label>
                <Input
                  id="promo-badge"
                  value={form.badgeText}
                  onChange={(event) => setForm((current) => ({ ...current, badgeText: event.target.value }))}
                  className="bg-eve-dark border-eve-border"
                  placeholder="Starter reward"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="promo-description">Description</Label>
              <Textarea
                id="promo-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="bg-eve-dark border-eve-border min-h-[120px]"
                placeholder="Invite new accounts to generate their personal premium code."
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="promo-button-text">Button Text</Label>
                <Input
                  id="promo-button-text"
                  value={form.buttonText}
                  onChange={(event) => setForm((current) => ({ ...current, buttonText: event.target.value }))}
                  className="bg-eve-dark border-eve-border"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label>Target Segment</Label>
                <Select
                  value={form.targetSegment}
                  onValueChange={(value) => setForm((current) => ({ ...current, targetSegment: value }))}
                >
                  <SelectTrigger className="bg-eve-dark border-eve-border">
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

              <div className="grid gap-2">
                <Label htmlFor="promo-account-age">Max Account Age (days)</Label>
                <Input
                  id="promo-account-age"
                  type="number"
                  min="1"
                  max="365"
                  value={form.maxAccountAgeDays}
                  onChange={(event) => setForm((current) => ({ ...current, maxAccountAgeDays: event.target.value }))}
                  className="bg-eve-dark border-eve-border"
                  placeholder="7"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="promo-priority">Priority</Label>
                <Input
                  id="promo-priority"
                  type="number"
                  min="0"
                  max="999"
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                  className="bg-eve-dark border-eve-border"
                  placeholder="100"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="promo-starts-at">Starts At</Label>
                <Input
                  id="promo-starts-at"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                  className="bg-eve-dark border-eve-border"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="promo-ends-at">Ends At</Label>
                <Input
                  id="promo-ends-at"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
                  className="bg-eve-dark border-eve-border"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-eve-border/50 bg-eve-dark/40 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">Banner Active</p>
                  <p className="text-xs text-gray-500">Inactive banners stay saved but never render on the dashboard.</p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-eve-border/50 bg-eve-dark/40 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">Dismissible</p>
                  <p className="text-xs text-gray-500">Allow the user to permanently hide the banner from their account.</p>
                </div>
                <Switch
                  checked={form.dismissible}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, dismissible: checked }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-eve-border text-gray-300 hover:text-white"
                  onClick={resetForm}
                >
                  Cancel Edit
                </Button>
              )}
              <Button
                type="submit"
                disabled={submitting}
                className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Gift className="h-4 w-4 mr-2" />
                )}
                {isEditing ? 'Save Banner' : 'Create Banner'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-eve-panel border-eve-border overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg text-white">Existing Campaigns</CardTitle>
          <CardDescription>
            Priority decides which campaigns appear first when multiple banners match the same user.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-eve-accent" />
            </div>
          ) : banners.length === 0 ? (
            <div className="rounded-xl border border-dashed border-eve-border/60 bg-eve-dark/20 px-6 py-10 text-center text-sm text-gray-500">
              No promo banners created yet.
            </div>
          ) : (
            banners.map((banner) => (
              <div
                key={banner.id}
                className={cn(
                  'rounded-2xl border p-5 transition-colors',
                  banner.isActive
                    ? 'border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent'
                    : 'border-eve-border/60 bg-eve-dark/20'
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {banner.badgeText && (
                        <Badge className="bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                          <Sparkles className="h-3 w-3 mr-1" />
                          {banner.badgeText}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] uppercase tracking-wider',
                          banner.isActive
                            ? 'border-green-500/40 text-green-300'
                            : 'border-zinc-600 text-zinc-400'
                        )}
                      >
                        {banner.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="border-zinc-600 text-zinc-300">
                        Priority {banner.priority}
                      </Badge>
                      <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                        7-day premium code
                      </Badge>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white">{banner.title}</h3>
                      <p className="mt-1 max-w-3xl text-sm text-gray-400">{banner.description}</p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-eve-border/50 bg-black/20 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Rule</p>
                        <p className="mt-1 text-sm text-white">{getBannerRuleSummary(banner)}</p>
                      </div>
                      <div className="rounded-xl border border-eve-border/50 bg-black/20 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">CTA</p>
                        <p className="mt-1 text-sm text-white">{banner.buttonText}</p>
                      </div>
                      <div className="rounded-xl border border-eve-border/50 bg-black/20 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Dismiss</p>
                        <p className="mt-1 text-sm text-white">{banner.dismissible ? 'Allowed' : 'Locked'}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-eve-border/50 bg-black/20 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Codes Generated</p>
                        <p className="mt-1 text-2xl font-black text-cyan-300">{banner.stats.claimCount}</p>
                      </div>
                      <div className="rounded-xl border border-eve-border/50 bg-black/20 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Codes Redeemed</p>
                        <p className="mt-1 text-2xl font-black text-green-300">{banner.stats.redeemedCount}</p>
                      </div>
                      <div className="rounded-xl border border-eve-border/50 bg-black/20 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Dismissals</p>
                        <p className="mt-1 text-2xl font-black text-amber-300">{banner.stats.dismissCount}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Created <FormattedDate date={banner.createdAt} />
                      </span>
                      <span>
                        Starts {banner.startsAt ? <FormattedDate date={banner.startsAt} /> : 'immediately'}
                      </span>
                      <span>
                        Ends {banner.endsAt ? <FormattedDate date={banner.endsAt} /> : 'never'}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      className="border-eve-border text-gray-200 hover:text-white"
                      onClick={() => loadBannerIntoForm(banner)}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => handleDelete(banner.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
