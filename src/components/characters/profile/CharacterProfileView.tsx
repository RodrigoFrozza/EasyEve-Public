'use client'

import { useId, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TimeAgo } from '@/components/time-ago'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { cn, formatSP } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { useCorporationInfo } from '@/lib/hooks/use-corporation-info'
import { useTypeNames } from '@/lib/hooks/use-type-names'
import { useSkillCatalog } from '@/lib/hooks/use-skill-catalog'
import { CollapsibleSection } from '@/components/characters/profile/CollapsibleSection'
import {
  Building2,
  Zap,
  Sparkles,
  GraduationCap,
  Brain,
  Clock,
  ShieldQuestion,
  Shield,
  Cpu,
  Puzzle,
  CalendarClock,
  ListChecks,
  Eye,
  Database,
  Flame,
  BookOpen,
  Users,
  Hourglass,
  Search,
  ChevronDown,
} from 'lucide-react'
import type { SharedProfileDto } from '@/lib/characters/share-profile'

// --- Raw ESI shapes carried as `unknown` JSON on the DTO. These are NOT
// validated by the API (see CharacterSnapshot.skills/skillqueue/attributes),
// so every read here is defensive — a malformed/missing field degrades to
// "no data" rather than throwing or fabricating a value. ---

interface RawSkillEntry {
  skill_id: number
  skillpoints_in_skill: number
  trained_skill_level: number
  active_skill_level: number
}

interface RawSkillQueueEntry {
  skill_id: number
  finished_level: number
  queue_position: number
  level_start_sp?: number
  level_end_sp?: number
  training_start_sp?: number
  start_date?: string
  finish_date?: string
}

interface RawAttributes {
  charisma: number
  intelligence: number
  memory: number
  perception: number
  willpower: number
  bonus_remaps?: number
  last_remap_date?: string
  accrued_remap_cooldown_date?: string
}

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V']

function romanLevel(level: number | undefined | null): string {
  if (level == null || level < 0 || level > 5) return '?'
  return ROMAN[level]
}

function parseSkills(value: unknown): RawSkillEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (s): s is RawSkillEntry => !!s && typeof s === 'object' && typeof (s as any).skill_id === 'number'
  )
}

function parseSkillQueue(value: unknown): RawSkillQueueEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((s): s is RawSkillQueueEntry => !!s && typeof s === 'object' && typeof (s as any).skill_id === 'number')
    .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0))
}

function parseAttributes(value: unknown): RawAttributes | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<RawAttributes>
  if (typeof v.charisma !== 'number' || typeof v.intelligence !== 'number') return null
  return v as RawAttributes
}

function parseImplants(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((n): n is number => typeof n === 'number')
}

function formatDurationMs(ms: number): string {
  if (ms <= 0) return '0m'
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function trainingProgressPercent(entry: RawSkillQueueEntry): number | null {
  if (!entry.start_date || !entry.finish_date) return null
  const start = new Date(entry.start_date).getTime()
  const finish = new Date(entry.finish_date).getTime()
  const now = Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(finish) || finish <= start) return null
  return Math.min(100, Math.max(0, ((now - start) / (finish - start)) * 100))
}

function getAgeParts(birthday: Date): { years: number; months: number } {
  const now = new Date()
  let years = now.getFullYear() - birthday.getFullYear()
  let months = now.getMonth() - birthday.getMonth()
  if (now.getDate() < birthday.getDate()) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }
  return { years: Math.max(0, years), months: Math.max(0, months) }
}

// --- Entrance animation: sections fade/slide in with a subtle stagger.
// Disabled (no offset, no delay) when the user prefers reduced motion. ---

const sectionContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const sectionItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

interface CharacterProfileViewProps {
  profile: SharedProfileDto | null
  loading?: boolean
  className?: string
  /** When true, every top-level section (Training, Skills, Attributes) starts
   * collapsed — used by the public share page so visitors see a compact
   * summary first. The owner's own page omits this (keeps Training open). */
  defaultCollapsed?: boolean
  /** Render sections as plain <div>s (no framer-motion entrance). The public
   * share page needs this: inside PublicPageChrome's near-black backdrop, the
   * motion-promoted GPU compositing layer paints behind it as a blank void. */
  disableEntranceAnimation?: boolean
}

export function CharacterProfileView({
  profile,
  loading = false,
  className,
  defaultCollapsed = false,
  disableEntranceAnimation = false,
}: CharacterProfileViewProps) {
  const reduceMotion = useReducedMotion()
  const skills = useMemo(() => parseSkills(profile?.skills), [profile])
  const skillQueue = useMemo(() => parseSkillQueue(profile?.skillqueue), [profile])
  const attributes = useMemo(() => parseAttributes(profile?.attributes), [profile])
  const implantIds = useMemo(() => parseImplants(profile?.implants), [profile])

  const skillIds = useMemo(() => {
    const ids = new Set<number>()
    for (const s of skills) ids.add(s.skill_id)
    for (const q of skillQueue) ids.add(q.skill_id)
    return Array.from(ids)
  }, [skills, skillQueue])

  const { data: corpInfo } = useCorporationInfo(profile?.corporationId ?? null)
  const { data: skillCatalog, isLoading: catalogLoading } = useSkillCatalog(skillIds)
  const { data: implantNames } = useTypeNames(implantIds)

  if (loading || !profile) {
    return <CharacterProfileSkeleton className={className} />
  }

  const staticEntrance = reduceMotion || disableEntranceAnimation

  // Static mode renders plain <div>s: framer-motion's entrance promotes the
  // subtree to its own GPU compositing layer, which inside PublicPageChrome's
  // near-black backdrop paints as a blank void on the public share page.
  const Container: React.ElementType = staticEntrance ? 'div' : motion.div
  const Item: React.ElementType = staticEntrance ? 'div' : motion.div
  const containerAnim = staticEntrance
    ? {}
    : { initial: 'hidden', animate: 'visible', variants: sectionContainerVariants }
  const itemAnim = staticEntrance ? {} : { variants: sectionItemVariants }

  return (
    <Container className={cn('space-y-6', className)} {...containerAnim}>
      <Item {...itemAnim}>
        <ProfileHeader profile={profile} corpName={corpInfo?.name} corpTicker={corpInfo?.ticker} />
      </Item>

      <Item {...itemAnim} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <AttributesSection attributes={attributes} implantIds={implantIds} implantNames={implantNames} />
        </div>
        <div className="lg:col-span-2">
          <TrainingSection
            queue={skillQueue}
            catalog={skillCatalog}
            catalogLoading={catalogLoading}
            defaultOpen={!defaultCollapsed}
          />
        </div>
      </Item>

      <Item {...itemAnim}>
        <SkillsSection skills={skills} catalog={skillCatalog} catalogLoading={catalogLoading} />
      </Item>

      <Item {...itemAnim}>
        <ProfileFooter capturedAt={profile.capturedAt} />
      </Item>
    </Container>
  )
}

function ProfileHeader({
  profile,
  corpName,
  corpTicker,
}: {
  profile: SharedProfileDto
  corpName?: string
  corpTicker?: string
}) {
  const { t } = useTranslations()

  const age = profile.birthday ? getAgeParts(new Date(profile.birthday)) : null
  const secColor =
    profile.securityStatus == null
      ? 'text-zinc-400'
      : profile.securityStatus >= 0
        ? 'text-emerald-400'
        : 'text-red-400'

  return (
    <Card className="relative overflow-hidden rounded-2xl border-eve-border bg-eve-panel">
      {/* Spatial backdrop — CSS gradients/glows only (no external hosts; CSP
          blocks them), kept inside the app's own eve-accent/eve-accent2 tokens. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="tech-grid-bg absolute inset-0 opacity-50" />
        <div className="animate-float-subtle absolute -left-16 -top-20 h-64 w-64 rounded-full bg-eve-accent/10 blur-3xl" />
        <div className="animate-nebula-drift absolute -right-10 -bottom-24 h-56 w-56 rounded-full bg-eve-accent2/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-eve-panel via-eve-panel/70 to-transparent" />
      </div>

      <CardContent className="relative z-10 flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="h-28 w-28 shrink-0 rounded-xl border border-eve-accent/25 shadow-eve-accent-glow-sm sm:h-32 sm:w-32">
            <AvatarImage src={`https://images.evetech.net/characters/${profile.characterId}/portrait?size=256`} />
            <AvatarFallback className="rounded-xl text-2xl">{profile.name[0]}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold text-white sm:text-3xl">{profile.name}</h1>
              {profile.isOmega === true && (
                <Badge variant="eve" className="gap-1">
                  <span aria-hidden className="leading-none">
                    Ω
                  </span>
                  {t('characterProfile.header.omega')}
                </Badge>
              )}
              {profile.isOmega === false && (
                <Badge variant="outline">{t('characterProfile.header.alpha')}</Badge>
              )}
              {profile.isOmega == null && (
                <Badge variant="warning">
                  <ShieldQuestion className="mr-1 h-3 w-3" />
                  {t('characterProfile.header.unknownSubscription')}
                </Badge>
              )}
            </div>

            {profile.corporationId && (
              <div className="flex items-center gap-2 text-sm text-amber-400">
                <Avatar className="h-5 w-5 rounded-full">
                  <AvatarImage src={`https://images.evetech.net/corporations/${profile.corporationId}/logo?size=64`} />
                  <AvatarFallback className="rounded-full">
                    <Building2 className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{corpName || t('characterProfile.header.unknownCorp')}</span>
                {corpTicker && <span className="text-zinc-500">[{corpTicker}]</span>}
              </div>
            )}

            {profile.birthday && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                <CalendarClock className="h-3 w-3" />
                <span>
                  {t('characterProfile.header.born')}: <FormattedDate date={profile.birthday} />
                </span>
                {age && (
                  <span className="text-zinc-600">
                    · {t('characterProfile.header.ageFormat', { years: age.years, months: age.months })}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <HeaderStat
                icon={Sparkles}
                label={t('characterProfile.header.unallocatedSp')}
                value={profile.unallocatedSp != null ? formatSP(profile.unallocatedSp) : t('characterProfile.noData')}
              />
              {profile.securityStatus != null && (
                <HeaderStat
                  icon={Shield}
                  label={t('characterProfile.header.securityStatus')}
                  value={profile.securityStatus.toFixed(1)}
                  valueClassName={secColor}
                />
              )}
            </div>
          </div>
        </div>

        <div className="animate-glow-pulse flex shrink-0 flex-col items-start gap-0.5 rounded-xl border border-eve-accent/25 bg-black/25 px-5 py-3 lg:items-end">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            <Zap className="h-3 w-3 text-eve-accent" />
            {t('characterProfile.header.totalSp')}
          </span>
          <span className="text-3xl font-bold tabular-nums text-eve-accent">
            {profile.totalSp != null ? formatSP(profile.totalSp) : t('characterProfile.noData')}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function HeaderStat({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ElementType
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 transition-colors hover:border-eve-accent/30">
      <Icon className="h-3 w-3 text-eve-accent" />
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span className={cn('text-xs font-bold tabular-nums text-zinc-200', valueClassName)}>{value}</span>
    </div>
  )
}

/** Small "label: value" box — the "derived stats" pill idiom shared by the
 * remap block. Value accepts a node so callers can drop in <FormattedDate>. */
function StatPill({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs transition-colors hover:border-eve-accent/20 hover:bg-black/25">
      <span className="text-zinc-500">{label}</span>
      <span className="font-semibold tabular-nums text-zinc-200">{value}</span>
    </div>
  )
}

/** 5 small segments representing skill levels I–V for one training queue
 * entry. Levels below the entry's target are shown as already secured;
 * the target level itself fills proportionally to training progress when
 * this is the actively-training (highlighted) entry, or as a solid
 * "queued" fill otherwise; levels above the target stay empty. */
function LevelSegments({
  finishedLevel,
  highlighted,
  progressPercent,
  reduceMotion,
  solid = false,
}: {
  finishedLevel: number
  highlighted: boolean
  progressPercent: number | null
  reduceMotion: boolean
  /** Trained-skill mode: every level up to `finishedLevel` is a solid cyan fill
   * (no amber "target" / no progress tween) — used for already-trained skills. */
  solid?: boolean
}) {
  const target = Math.min(5, Math.max(0, finishedLevel || 0))

  if (solid) {
    return (
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4, 5].map((lvl) => (
          <div
            key={lvl}
            className="relative h-1.5 flex-1 overflow-hidden rounded-[3px] border border-eve-border/50 bg-black/30"
          >
            {lvl <= target && <div className="absolute inset-0 bg-eve-accent/60" />}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-1" aria-hidden>
      {[1, 2, 3, 4, 5].map((lvl) => {
        const isPast = lvl < target
        const isTarget = target > 0 && lvl === target

        return (
          <div
            key={lvl}
            className="relative h-1.5 flex-1 overflow-hidden rounded-[3px] border border-eve-border/50 bg-black/30"
          >
            {isPast && <div className="absolute inset-0 bg-eve-accent/60" />}
            {isTarget &&
              (highlighted ? (
                <motion.div
                  className="absolute inset-y-0 left-0 bg-eve-accent"
                  initial={{ width: reduceMotion ? `${progressPercent ?? 100}%` : 0 }}
                  animate={{ width: `${progressPercent ?? 100}%` }}
                  transition={{ duration: reduceMotion ? 0 : 0.8, ease: 'easeOut' }}
                />
              ) : (
                <div className="absolute inset-0 bg-eve-accent2/60" />
              ))}
          </div>
        )
      })}
    </div>
  )
}

function TrainingSection({
  queue,
  catalog,
  catalogLoading,
  defaultOpen = true,
}: {
  queue: RawSkillQueueEntry[]
  catalog: Record<number, { name: string; groupName: string }> | undefined
  catalogLoading: boolean
  defaultOpen?: boolean
}) {
  const { t } = useTranslations()
  const reduceMotion = useReducedMotion()

  const current = queue[0]
  const isPaused = !!current && !current.finish_date
  const upcoming = queue.slice(1)
  const overallProgress = current ? trainingProgressPercent(current) : null

  const summary = useMemo(() => {
    if (!current) return t('characterProfile.training.empty')
    const skillName = catalog?.[current.skill_id]?.name || t('characterProfile.skills.unknownSkill', { id: current.skill_id })
    const eta = isPaused
      ? t('characterProfile.training.paused')
      : current.finish_date
        ? formatDurationMs(new Date(current.finish_date).getTime() - Date.now())
        : t('characterProfile.training.noEta')
    return t('characterProfile.training.summary', { skill: skillName, eta })
  }, [current, catalog, isPaused, t])

  // Total remaining time across the whole queue: the last entry's
  // finish_date is already cumulative (each entry starts when the previous
  // one finishes), so it doubles as the queue's total ETA.
  const totalEtaMs = useMemo(() => {
    if (queue.length === 0) return null
    const last = queue[queue.length - 1]
    if (!last.finish_date) return null
    const ms = new Date(last.finish_date).getTime() - Date.now()
    return Number.isFinite(ms) && ms > 0 ? ms : null
  }, [queue])

  return (
    <CollapsibleSection
      icon={GraduationCap}
      title={t('characterProfile.training.title')}
      summary={summary}
      defaultOpen={defaultOpen}
      contentClassName="custom-scrollbar max-h-[32rem] overflow-y-auto"
    >
      {queue.length === 0 ? (
        <p className="text-sm text-zinc-500">{t('characterProfile.training.empty')}</p>
      ) : (
        <div className="space-y-3">
          {(isPaused || totalEtaMs != null) && (
            <div className="flex flex-wrap items-center gap-2">
              {isPaused && <Badge variant="warning">{t('characterProfile.training.paused')}</Badge>}
              {totalEtaMs != null && (
                <div className="flex items-center gap-2 rounded-lg border border-eve-accent/25 bg-black/25 px-3 py-1.5 shadow-eve-accent-glow-xs">
                  <Hourglass className="h-3.5 w-3.5 text-eve-accent" />
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                    {t('characterProfile.training.queueEta')}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-eve-accent">
                    {formatDurationMs(totalEtaMs)}
                  </span>
                </div>
              )}
            </div>
          )}

          {current && (
            <SkillQueueRow entry={current} catalog={catalog} catalogLoading={catalogLoading} highlighted />
          )}

          {upcoming.length > 0 && (
            <div className="space-y-1.5 border-t border-eve-border/50 pt-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <ListChecks className="h-3 w-3" />
                {t('characterProfile.training.queue', { count: upcoming.length })}
              </p>
              {upcoming.map((entry, idx) => (
                <SkillQueueRow
                  key={`${entry.skill_id}-${entry.queue_position ?? idx}`}
                  entry={entry}
                  catalog={catalog}
                  catalogLoading={catalogLoading}
                />
              ))}
            </div>
          )}

          {overallProgress != null && (
            <div className="border-t border-eve-border/50 pt-2.5">
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-zinc-500">
                <span>{t('characterProfile.training.overallProgress')}</span>
                <span className="tabular-nums text-zinc-400">{Math.round(overallProgress)}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full border border-eve-border/30 bg-black/30">
                <motion.div
                  className="h-full bg-eve-accent"
                  initial={{ width: reduceMotion ? `${overallProgress}%` : 0 }}
                  animate={{ width: `${overallProgress}%` }}
                  transition={{ duration: reduceMotion ? 0 : 0.9, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  )
}

function SkillQueueRow({
  entry,
  catalog,
  catalogLoading,
  highlighted = false,
}: {
  entry: RawSkillQueueEntry
  catalog: Record<number, { name: string; groupName: string }> | undefined
  catalogLoading: boolean
  highlighted?: boolean
}) {
  const { t } = useTranslations()
  const reduceMotion = useReducedMotion()
  const name = catalog?.[entry.skill_id]?.name
  const progress = highlighted ? trainingProgressPercent(entry) : null

  return (
    <div
      className={cn(
        'space-y-1.5 rounded-lg border border-white/5 bg-black/20 p-2.5 transition-colors hover:border-white/10 hover:bg-black/30',
        highlighted && 'border-eve-accent/30 bg-eve-accent/5 hover:border-eve-accent/40'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-zinc-200">
          {catalogLoading && !name ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            name || t('characterProfile.skills.unknownSkill', { id: entry.skill_id })
          )}{' '}
          <span className="text-zinc-500">{romanLevel(entry.finished_level)}</span>
        </span>
        {entry.finish_date ? (
          <span className="shrink-0 text-xs tabular-nums text-eve-accent">
            {formatDurationMs(new Date(entry.finish_date).getTime() - Date.now())}
          </span>
        ) : (
          <span className="shrink-0 text-xs text-zinc-500">{t('characterProfile.training.noEta')}</span>
        )}
      </div>
      <LevelSegments
        finishedLevel={entry.finished_level}
        highlighted={highlighted}
        progressPercent={progress}
        reduceMotion={!!reduceMotion}
      />
    </div>
  )
}

function SkillsSection({
  skills,
  catalog,
  catalogLoading,
}: {
  skills: RawSkillEntry[]
  catalog: Record<number, { name: string; groupId: number; groupName: string }> | undefined
  catalogLoading: boolean
}) {
  const { t } = useTranslations()
  const reduceMotion = useReducedMotion()
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')

  // All groups, unfiltered — powers the category dropdown, totals and summary.
  const allGroups = useMemo(() => {
    const map = new Map<string, { name: string; sp: number; skills: Array<{ entry: RawSkillEntry; name: string }> }>()
    for (const skill of skills) {
      const info = catalog?.[skill.skill_id]
      const groupName = info?.groupName || t('characterProfile.skills.unknownGroup')
      const skillName = info?.name || t('characterProfile.skills.unknownSkill', { id: skill.skill_id })
      if (!map.has(groupName)) {
        map.set(groupName, { name: groupName, sp: 0, skills: [] })
      }
      const g = map.get(groupName)!
      g.sp += skill.skillpoints_in_skill || 0
      g.skills.push({ entry: skill, name: skillName })
    }
    return Array.from(map.values())
      .map((g) => ({ ...g, skills: g.skills.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [skills, catalog, t])

  // Apply the name search + category filter.
  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allGroups
      .filter((g) => groupFilter === 'all' || g.name === groupFilter)
      .map((g) => ({
        ...g,
        skills: q ? g.skills.filter((s) => s.name.toLowerCase().includes(q)) : g.skills,
      }))
      .filter((g) => g.skills.length > 0)
  }, [allGroups, groupFilter, search])

  const totalSp = useMemo(() => skills.reduce((sum, s) => sum + (s.skillpoints_in_skill || 0), 0), [skills])

  const summary =
    skills.length === 0
      ? t('characterProfile.skills.empty')
      : t('characterProfile.skills.summary', { count: skills.length, sp: formatSP(totalSp) })

  return (
    <CollapsibleSection icon={Cpu} title={t('characterProfile.skills.title')} summary={summary}>
      {skills.length === 0 ? (
        <p className="text-sm text-zinc-500">{t('characterProfile.skills.empty')}</p>
      ) : catalogLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Filter bar: search by skill name + filter by category */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('characterProfile.skills.searchPlaceholder')}
                className="h-9 border-eve-border bg-black/30 pl-8 text-sm"
              />
            </div>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="h-9 border-eve-border bg-black/30 text-sm sm:w-56">
                <SelectValue placeholder={t('characterProfile.skills.allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('characterProfile.skills.allCategories')}</SelectItem>
                {allGroups.map((g) => (
                  <SelectItem key={g.name} value={g.name}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="custom-scrollbar max-h-[28rem] overflow-y-auto pr-3">
            {visibleGroups.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                {t('characterProfile.skills.noMatches')}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleGroups.map((group) => (
                  <CollapsibleSkillGroup
                    key={group.name}
                    name={group.name}
                    sp={group.sp}
                    skills={group.skills}
                    forceOpen={search.trim().length > 0}
                    reduceMotion={!!reduceMotion}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}

/** One skill-group card inside the "Trained skills" section, collapsible
 * independently of its siblings. Defaults closed; `forceOpen` (driven by an
 * active search term upstream) expands it regardless of local toggle state
 * so matches are visible without an extra click. */
function CollapsibleSkillGroup({
  name,
  sp,
  skills,
  forceOpen,
  reduceMotion,
}: {
  name: string
  sp: number
  skills: Array<{ entry: RawSkillEntry; name: string }>
  forceOpen: boolean
  reduceMotion: boolean
}) {
  const { t } = useTranslations()
  const [open, setOpen] = useState(false)
  const isOpen = forceOpen || open
  const contentId = useId()

  const list = (
    <ul className="space-y-2 px-3 pb-3">
      {skills.map(({ entry, name: skillName }) => (
        <li key={entry.skill_id} className="space-y-1 rounded-md px-1.5 py-1 transition-colors hover:bg-white/5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-zinc-300">
              {skillName} <span className="text-zinc-500">{romanLevel(entry.trained_skill_level)}</span>
            </span>
            <span className="shrink-0 tabular-nums text-zinc-400">{formatSP(entry.skillpoints_in_skill)}</span>
          </div>
          <LevelSegments
            finishedLevel={entry.trained_skill_level}
            highlighted={false}
            progressPercent={null}
            reduceMotion={reduceMotion}
            solid
          />
        </li>
      ))}
    </ul>
  )

  return (
    <div className="rounded-xl border border-white/5 bg-black/20 transition-colors hover:border-eve-accent/20 hover:bg-black/25">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-eve-accent"
      >
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-300">{name}</span>
          <span className="shrink-0 text-[10px] text-zinc-500">
            {t('characterProfile.skills.count', { count: skills.length })}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="rounded-md border border-white/5 bg-black/40 px-2 py-0.5 text-xs font-bold tabular-nums text-eve-accent">
            {formatSP(sp)}
          </span>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="text-zinc-500"
            aria-hidden
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.span>
        </span>
      </button>

      {reduceMotion ? (
        isOpen && <div id={contentId}>{list}</div>
      ) : (
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="content"
              id={contentId}
              initial="collapsed"
              animate="open"
              exit="collapsed"
              variants={{
                open: { height: 'auto', opacity: 1 },
                collapsed: { height: 0, opacity: 0 },
              }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              {list}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

const ATTRIBUTE_DEFS: Array<{ key: keyof RawAttributes; icon: React.ElementType }> = [
  { key: 'perception', icon: Eye },
  { key: 'memory', icon: Database },
  { key: 'willpower', icon: Flame },
  { key: 'intelligence', icon: BookOpen },
  { key: 'charisma', icon: Users },
]

function AttributesSection({
  attributes,
  implantIds,
  implantNames,
}: {
  attributes: RawAttributes | null
  implantIds: number[]
  implantNames: Record<number, string> | undefined
}) {
  const { t } = useTranslations()

  const summary = !attributes
    ? t('characterProfile.attributes.noData')
    : t('characterProfile.attributes.summary', { count: ATTRIBUTE_DEFS.length, implants: implantIds.length })

  return (
    <CollapsibleSection icon={Puzzle} title={t('characterProfile.attributes.title')} summary={summary} contentClassName="custom-scrollbar max-h-[32rem] overflow-y-auto">
      {!attributes ? (
        <p className="text-sm text-zinc-500">{t('characterProfile.attributes.noData')}</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-eve-accent">
              <Brain className="h-3 w-3" />
              {t('characterProfile.attributes.coreStats')}
            </p>
            <div className="space-y-1.5">
              {ATTRIBUTE_DEFS.map(({ key, icon: Icon }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 transition-colors hover:border-eve-accent/20 hover:bg-black/30"
                >
                  <span className="flex items-center gap-2 text-xs text-zinc-400">
                    <Icon className="h-3.5 w-3.5 text-eve-accent" />
                    {t(`characterProfile.attributes.${key}`)}
                  </span>
                  <span className="rounded-md border border-white/5 bg-black/40 px-2 py-0.5 text-sm font-bold tabular-nums text-zinc-100">
                    {attributes[key]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-eve-border/50 pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-eve-accent">
              <CalendarClock className="h-3 w-3" />
              {t('characterProfile.attributes.derivedStats')}
            </p>
            <div className="space-y-1.5">
              <StatPill
                label={t('characterProfile.attributes.bonusRemaps')}
                value={attributes.bonus_remaps != null ? attributes.bonus_remaps : t('characterProfile.noData')}
              />
              <StatPill
                label={t('characterProfile.attributes.lastRemap')}
                value={
                  attributes.last_remap_date ? (
                    <FormattedDate date={attributes.last_remap_date} />
                  ) : (
                    t('characterProfile.attributes.neverRemapped')
                  )
                }
              />
              <StatPill
                label={t('characterProfile.attributes.remapCooldown')}
                value={
                  attributes.accrued_remap_cooldown_date ? (
                    <FormattedDate date={attributes.accrued_remap_cooldown_date} mode="datetime" />
                  ) : (
                    t('characterProfile.attributes.remapAvailableNow')
                  )
                }
              />
            </div>
          </div>

          <div className="border-t border-eve-border/50 pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {t('characterProfile.attributes.implants')}
            </p>
            {implantIds.length === 0 ? (
              <p className="text-sm text-zinc-500">{t('characterProfile.attributes.noImplants')}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {implantIds.map((id) => (
                  <Badge
                    key={id}
                    variant="outline"
                    className="gap-1.5 rounded-full py-0.5 pl-1 pr-2.5 text-xs transition-colors hover:border-eve-accent/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://images.evetech.net/types/${id}/icon?size=32`}
                      alt=""
                      width={24}
                      height={24}
                      loading="lazy"
                      className="h-6 w-6 shrink-0 rounded-full"
                    />
                    {implantNames?.[id] || t('characterProfile.attributes.unknownImplant', { id })}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}

function ProfileFooter({ capturedAt }: { capturedAt: Date | string | null }) {
  const { t } = useTranslations()
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-black/10 px-3 py-2 text-xs text-zinc-500">
      <Clock className="h-3 w-3" />
      {capturedAt ? (
        <>
          {t('characterProfile.footer.updatedPrefix')} <TimeAgo date={capturedAt} />
        </>
      ) : (
        t('characterProfile.footer.neverUpdated')
      )}
    </div>
  )
}

function CharacterProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <Card className="rounded-2xl border-eve-border bg-eve-panel">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex flex-1 gap-4">
            <Skeleton className="h-28 w-28 shrink-0 rounded-xl sm:h-32 sm:w-32" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
            </div>
          </div>
          <Skeleton className="h-16 w-40 shrink-0 rounded-xl" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="rounded-xl border-eve-border bg-eve-panel lg:col-span-1">
          <CardContent className="space-y-2 p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card className="rounded-xl border-eve-border bg-eve-panel lg:col-span-2">
          <CardContent className="space-y-2 p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-xl border-eve-border bg-eve-panel">
        <CardContent className="space-y-2 p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
