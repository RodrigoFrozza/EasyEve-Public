'use client'

import { useState } from 'react'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Edit2, Save, X, Terminal, Quote } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface ProfileBioProps {
  bio: string | null
  isEditable: boolean
  onSave?: (newBio: string) => Promise<void>
}

export function ProfileBio({ bio, isEditable, onSave }: ProfileBioProps) {
  const { t } = useTranslations()
  const [isEditing, setIsEditing] = useState(false)
  const [currentBio, setCurrentBio] = useState(bio || '')
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    if (!onSave) return
    setIsLoading(true)
    try {
      await onSave(currentBio)
      setIsEditing(false)
      toast.success(t('players.profile.bio.success'))
    } catch (error) {
      toast.error(t('players.profile.bio.error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
            <Terminal className="h-3.5 w-3.5 text-eve-accent" />
          </div>
          <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-white/70 font-outfit">
            {t('players.profile.bio.title')}
          </h3>
        </div>
        {isEditable && !isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-8 px-4 text-[10px] font-black uppercase tracking-widest text-eve-accent hover:text-white hover:bg-eve-accent/10 rounded-xl font-outfit border border-eve-accent/20 transition-all"
          >
            <Edit2 className="h-3 w-3 mr-2" />
            {t('players.profile.bio.edit')}
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div 
            key="editing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-eve-accent/20 to-transparent rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm" />
              <Textarea
                value={currentBio}
                onChange={(e) => setCurrentBio(e.target.value)}
                placeholder={t('players.profile.bio.placeholder')}
                className="relative bg-black/60 border-white/5 rounded-2xl min-h-[160px] focus-visible:border-eve-accent/50 focus-visible:ring-eve-accent/10 transition-all font-inter text-sm leading-relaxed scrollbar-thin scrollbar-thumb-white/10"
                maxLength={500}
              />
              <div className="absolute bottom-3 right-4 text-[10px] font-black text-white/20 uppercase tracking-tighter">
                {currentBio.length} / 500
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(false)
                  setCurrentBio(bio || '')
                }}
                className="h-10 px-5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white rounded-xl font-outfit transition-all"
              >
                <X className="h-3.5 w-3.5 mr-2" />
                {t('players.profile.bio.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isLoading}
                className="h-10 px-6 bg-eve-accent hover:bg-eve-accent/80 text-black text-[10px] font-black uppercase tracking-widest rounded-xl font-outfit shadow-lg shadow-eve-accent/20 border-0"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-2" />
                )}
                {t('players.profile.bio.save')}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="display"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "relative p-8 rounded-[32px] border border-white/5 bg-white/[0.02] backdrop-blur-md group",
              !bio && "italic text-zinc-600"
            )}
          >
            <div className="absolute top-6 left-6 opacity-5">
              <Quote className="h-12 w-12 text-white" />
            </div>
            <p className="relative z-10 text-[15px] text-white/80 leading-relaxed font-inter whitespace-pre-wrap tracking-wide">
              {bio || t('players.profile.bio.empty')}
            </p>
            <div className="absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-eve-accent/20 to-transparent" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg 
      className={cn("animate-spin", className)} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  )
}

