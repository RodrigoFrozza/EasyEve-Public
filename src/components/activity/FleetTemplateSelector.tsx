'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Edit2, Trash2, Tag, Users, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { CHARACTER_ACTIVITY_TAGS } from '@/constants/character-tags'
import { useTranslations } from '@/i18n/hooks'

interface Character {
  id: number
  name: string
  isMain: boolean
  tags: string[]
}

interface TemplateParticipant {
  characterId: number
}

interface FleetTemplate {
  id: string
  name: string
  activityType: string
  participants: TemplateParticipant[]
  createdAt: string
  updatedAt: string
}

interface FleetTemplateSelectorProps {
  characters: Character[]
  selectedParticipants: { characterId: number; characterName?: string }[]
  onParticipantsChange: (participants: { characterId: number; characterName: string }[]) => void
  activityType: string
  isPremium: boolean
}

type PresetByTag = {
  tag: string
  characters: Character[]
}

type DropdownOption = {
  type: 'preset' | 'custom' | 'divider'
  label: string
  value: string
  disabled?: boolean
  chars?: Character[]
  template?: FleetTemplate
}

export function FleetTemplateSelector({
  characters,
  selectedParticipants,
  onParticipantsChange,
  activityType,
  isPremium
}: FleetTemplateSelectorProps) {
  const { t } = useTranslations()
  const [templates, setTemplates] = useState<FleetTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<FleetTemplate | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [templateParticipants, setTemplateParticipants] = useState<number[]>([])
  const [currentActivityType, setCurrentActivityType] = useState(activityType)

  // Reset selected template when activityType changes
  useEffect(() => {
    if (activityType !== currentActivityType) {
      setSelectedTemplate(null)
      setCurrentActivityType(activityType)
    }
  }, [activityType, currentActivityType])

  const presetsByTag = useMemo<PresetByTag[]>(() => {
    return CHARACTER_ACTIVITY_TAGS
      .map(tag => {
        const charsWithTag = characters.filter(c => c.tags?.includes(tag))
        return { tag, characters: charsWithTag }
      })
      .filter(preset => preset.characters.length > 0)
  }, [characters])

  const customTemplates = useMemo(() => {
    return templates.filter(t => t.activityType === activityType)
  }, [templates, activityType])

  useEffect(() => {
    if (isPremium) {
      fetch('/api/fleet-templates')
        .then(res => res.json())
        .then(data => setTemplates(Array.isArray(data) ? data : []))
        .catch(() => setTemplates([]))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [isPremium])

  const dropdownOptions = useMemo<DropdownOption[]>(() => {
    const options: DropdownOption[] = []
    
    if (presetsByTag.length > 0) {
      options.push({ type: 'divider', label: 'PRESETS BY TAG', value: '', disabled: true })
      presetsByTag.forEach(preset => {
        options.push({
          type: 'preset',
          label: `${preset.tag} (${preset.characters.length})`,
          value: `preset:${preset.tag}`,
          chars: preset.characters
        })
      })
    }
    
    if (customTemplates.length > 0 || presetsByTag.length > 0) {
      options.push({ type: 'divider', label: 'MY TEMPLATES', value: '', disabled: true })
    }
    
    if (customTemplates.length > 0) {
      customTemplates.forEach(template => {
        options.push({
          type: 'custom',
          label: `${template.name} (${(template.participants as TemplateParticipant[]).length})`,
          value: `custom:${template.id}`,
          template
        })
      })
    } else if (presetsByTag.length === 0) {
      options.push({ type: 'divider', label: 'No templates available', value: '', disabled: true })
    }
    
    return options
  }, [presetsByTag, customTemplates])

  const handleTemplateChange = (value: string) => {
    if (!value) return
    
    if (value.startsWith('preset:')) {
      const tag = value.replace('preset:', '')
      const preset = presetsByTag.find(p => p.tag === tag)
      if (preset) {
        setSelectedTemplate(value)
        onParticipantsChange(preset.characters.map(c => ({ characterId: c.id, characterName: c.name })))
      }
    } else if (value.startsWith('custom:')) {
      const templateId = value.replace('custom:', '')
      const template = customTemplates.find(t => t.id === templateId)
      if (template) {
        const participantIds = (template.participants as TemplateParticipant[]).map(p => p.characterId)
        const participants = participantIds
          .map(id => {
            const char = characters.find(c => c.id === id)
            return char ? { characterId: id, characterName: char.name } : null
          })
          .filter((p): p is { characterId: number; characterName: string } => p !== null)
        
        setSelectedTemplate(value)
        onParticipantsChange(participants)
      }
    }
  }

  const handleOpenCreateDialog = () => {
    setNewTemplateName('')
    setTemplateParticipants(selectedParticipants.map(p => p.characterId))
    setEditingTemplate(null)
    setIsCreateDialogOpen(true)
  }

  const handleOpenEditDialog = (template: FleetTemplate, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTemplate(template)
    setNewTemplateName(template.name)
    setTemplateParticipants((template.participants as TemplateParticipant[]).map(p => p.characterId))
    setIsCreateDialogOpen(true)
  }

  const handleDeleteTemplate = async (template: FleetTemplate, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete template "${template.name}"?`)) return
    
    try {
      await fetch(`/api/fleet-templates/${template.id}`, { method: 'DELETE' })
      setTemplates(prev => prev.filter(t => t.id !== template.id))
      if (selectedTemplate === `custom:${template.id}`) {
        setSelectedTemplate(null)
        onParticipantsChange([])
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
  }

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim() || templateParticipants.length === 0) return

    const payload = {
      name: newTemplateName.trim(),
      activityType,
      participants: templateParticipants.map(id => ({ characterId: id }))
    }

    try {
      let response
      if (editingTemplate) {
        response = await fetch(`/api/fleet-templates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        response = await fetch('/api/fleet-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      if (response.ok) {
        const savedTemplate = await response.json()
        if (editingTemplate) {
          setTemplates(prev => prev.map(t => t.id === savedTemplate.id ? savedTemplate : t))
        } else {
          setTemplates(prev => [savedTemplate, ...prev])
        }
        setIsCreateDialogOpen(false)
        handleTemplateChange(`custom:${savedTemplate.id}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save template')
      }
    } catch (error) {
      console.error('Failed to save template:', error)
    }
  }

  const toggleTemplateParticipant = (charId: number) => {
    setTemplateParticipants(prev => 
      prev.includes(charId) 
        ? prev.filter(id => id !== charId)
        : [...prev, charId]
    )
  }

  if (!isPremium) {
    return null
  }

  const currentValue = selectedTemplate || ''

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2">
            <Crown className="h-3 w-3 text-amber-400" />
            Fleet
          </Label>
          
          {customTemplates.length < 10 && (
            <button
              onClick={handleOpenCreateDialog}
              className="text-[9px] text-eve-accent hover:text-eve-accent/80 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> new
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-zinc-500 text-xs">Loading...</div>
        ) : dropdownOptions.length <= 1 ? (
          <p className="text-[9px] text-zinc-600 italic">No templates</p>
        ) : (
          <>
            <Select value={currentValue} onValueChange={handleTemplateChange}>
              <SelectTrigger className="h-9 bg-zinc-900 border-zinc-800 text-xs">
                <SelectValue placeholder="Select template...">
                  {(() => {
                    if (!currentValue) return "Select template..."
                    const selected = dropdownOptions.find(opt => opt.value === currentValue)
                    return selected?.label || "Select template..."
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 max-h-[250px]">
                {dropdownOptions.map((option, idx) => {
                  if (option.type === 'divider') {
                    return (
                      <div 
                        key={idx} 
                        className="px-2 py-1.5 text-[9px] uppercase font-black text-zinc-500 border-t border-zinc-800 cursor-default"
                      >
                        {option.label}
                      </div>
                    )
                  }
                  return (
                    <SelectItem 
                      key={option.value} 
                      value={option.value}
                      className="text-xs cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        {option.type === 'preset' ? (
                          <Tag className="h-3 w-3" />
                        ) : (
                          <Users className="h-3 w-3" />
                        )}
                        {option.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            {selectedTemplate?.startsWith('custom:') && (
              <div className="flex items-center gap-1">
                {(() => {
                  const templateId = selectedTemplate.replace('custom:', '')
                  const template = customTemplates.find(t => t.id === templateId)
                  if (!template) return null
                  return (
                    <>
                      <button
                        onClick={(e) => handleOpenEditDialog(template, e as any)}
                        className="p-1 text-zinc-500 hover:text-white"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteTemplate(template, e as any)}
                        className="p-1 text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )
                })()}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="bg-[#050507] border-eve-border/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase">
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Configure your fleet template name and select participating characters.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-zinc-400">Template Name</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., My Dual Box Ratters"
                className="bg-zinc-900 border-zinc-800"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-zinc-400">
                Select Characters ({templateParticipants.length})
              </Label>
              <ScrollArea className="h-[200px] rounded-lg border border-zinc-800 p-2">
                <div className="space-y-1">
                  {characters.map(char => (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => toggleTemplateParticipant(char.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-lg border transition-all",
                        templateParticipants.includes(char.id)
                          ? "border-eve-accent bg-eve-accent/10" 
                          : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900"
                      )}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={`https://images.evetech.net/characters/${char.id}/portrait?size=64`} />
                        <AvatarFallback className="text-[10px]">{char.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-zinc-300 truncate">{char.name}</p>
                        {char.tags && char.tags.length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {char.tags.slice(0, 2).map(tag => (
                              <Badge key={tag} variant="outline" className="text-[8px] h-3 px-1">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-[9px] text-zinc-600 italic">Fit selection coming soon</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              className="border-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!newTemplateName.trim() || templateParticipants.length === 0}
              className="bg-eve-accent text-black hover:bg-eve-accent/80"
            >
              {editingTemplate ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}