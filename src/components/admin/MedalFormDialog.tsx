'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, AlertCircle } from 'lucide-react'
import { TIER_OPTIONS, TYPE_OPTIONS, CRITERIA_TYPE_OPTIONS, ACTIVITY_OPTIONS, buildCriteria, parseCriteria, type Medal } from '@/lib/medals/types'

interface MedalFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  medal?: Medal | null
  onSuccess?: () => void
}

export function MedalFormDialog({ open, onOpenChange, medal, onSuccess }: MedalFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('🎖️')
  const [tier, setTier] = useState<string>('bronze')
  const [type, setType] = useState<string>('instant')
  const [criteriaType, setCriteriaType] = useState<string>('hours')
  const [criteriaValue, setCriteriaValue] = useState<number>(10)
  const [criteriaActivity, setCriteriaActivity] = useState<string>('')
  const [customJson, setCustomJson] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [isActive, setIsActive] = useState(true)

  const isEdit = !!medal

  useEffect(() => {
    if (medal) {
      setName(medal.name)
      setDescription(medal.description || '')
      setIcon(medal.icon || '🎖️')
      setTier(medal.tier)
      setType(medal.type)
      setIsActive(medal.isActive)

      // Parse criteria
      try {
        const parsed = parseCriteria(medal.criteria)
        if (parsed.type === 'custom') {
          setUseCustom(true)
          setCustomJson(JSON.stringify(parsed, null, 2))
        } else {
          setUseCustom(false)
          setCriteriaType(parsed.type)
          setCriteriaValue(parsed.value)
          setCriteriaActivity(parsed.activity || '')
        }
      } catch {
        setUseCustom(true)
        setCustomJson(medal.criteria)
      }
    } else {
      // Reset form for new medal
      setName('')
      setDescription('')
      setIcon('🎖️')
      setTier('bronze')
      setType('instant')
      setIsActive(true)
      setCriteriaType('hours')
      setCriteriaValue(10)
      setCriteriaActivity('')
      setUseCustom(false)
      setCustomJson('')
    }
  }, [medal, open])

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      let criteriaJson: string

      if (useCustom) {
        if (!customJson.trim()) {
          setError('Custom criteria JSON is required')
          setLoading(false)
          return
        }
        try {
          JSON.parse(customJson)
        } catch {
          setError('Invalid JSON format')
          setLoading(false)
          return
        }
        criteriaJson = customJson
      } else {
        if (criteriaType === 'first_activity') {
          criteriaJson = buildCriteria({ type: 'first_activity', value: 1 })
        } else {
          criteriaJson = buildCriteria({ 
            type: criteriaType as 'hours' | 'count' | 'ranking', 
            value: criteriaValue,
            activity: criteriaActivity as 'mining' | 'ratting' | 'exploration' | undefined
          })
        }
      }

      const payload = {
        name,
        description: description || null,
        icon: icon || null,
        tier,
        type,
        criteria: criteriaJson,
        isActive,
      }

      const action = isEdit ? 'update' : 'create'
      const body = isEdit 
        ? { action, medalId: medal.id, ...payload }
        : { action, ...payload }

      const res = await fetch('/api/admin/medals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(isEdit ? 'Medal updated' : 'Medal created')
        onSuccess?.()
        onOpenChange(false)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save medal')
      }
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Validation
  const canSubmit = name.trim() && (useCustom ? customJson.trim() : criteriaValue > 0)

  const selectedCriteriaOption = CRITERIA_TYPE_OPTIONS.find(o => o.value === criteriaType)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-eve-panel border-eve-border text-white">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Medal' : 'Create Medal'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the medal details below.' : 'Create a new medal for players to earn.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Medal name"
              className="bg-eve-dark border-eve-border"
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this medal represents..."
              className="bg-eve-dark border-eve-border min-h-[80px]"
            />
          </div>

          {/* Icon */}
          <div className="grid gap-2">
            <Label htmlFor="icon">Icon (Emoji)</Label>
            <Input
              id="icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🎖️"
              className="bg-eve-dark border-eve-border w-20"
              maxLength={10}
            />
          </div>

          {/* Tier & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Tier</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger className="bg-eve-dark border-eve-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span style={{ color: opt.color }}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-eve-dark border-eve-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Criteria */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Criteria</Label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useCustom"
                  checked={useCustom}
                  onChange={(e) => setUseCustom(e.target.checked)}
                  className="rounded border-eve-border"
                />
                <Label htmlFor="useCustom" className="text-xs text-zinc-400">Custom JSON</Label>
              </div>
            </div>

            {useCustom ? (
              <Textarea
                value={customJson}
                onChange={(e) => setCustomJson(e.target.value)}
                placeholder='{"type": "custom", "value": 100, "customField": "value"}'
                className="bg-eve-dark border-eve-border font-mono text-xs min-h-[120px]"
              />
            ) : (
              <div className="grid gap-3 p-3 bg-eve-dark/50 rounded-lg border border-eve-border/50">
                <Select value={criteriaType} onValueChange={setCriteriaType}>
                  <SelectTrigger className="bg-eve-dark border-eve-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRITERIA_TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedCriteriaOption?.activityRequired && (
                  <Select 
                    value={criteriaActivity} 
                    onValueChange={setCriteriaActivity}
                  >
                    <SelectTrigger className="bg-eve-dark border-eve-border">
                      <SelectValue placeholder="Select activity" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {!selectedCriteriaOption?.activityRequired && criteriaType !== 'first_activity' && (
                  <div className="grid gap-2">
                    <Label className="text-xs text-zinc-400">Value</Label>
                    <Input
                      type="number"
                      value={criteriaValue}
                      onChange={(e) => setCriteriaValue(parseInt(e.target.value) || 0)}
                      min={1}
                      className="bg-eve-dark border-eve-border"
                    />
                  </div>
                )}

                {criteriaType === 'first_activity' && (
                  <p className="text-xs text-zinc-500">
                    This medal is awarded for completing the first activity. Value is always 1.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Active */}
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="text-zinc-400"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="bg-eve-accent text-black hover:bg-eve-accent/80"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Update Medal' : 'Create Medal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}