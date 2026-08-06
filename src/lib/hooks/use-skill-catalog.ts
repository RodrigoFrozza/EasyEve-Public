'use client'

import { useQuery } from '@tanstack/react-query'
import type { SkillTypeCatalogEntry } from '@/lib/sde'

/**
 * Batch-resolves skill type IDs to { name, groupId, groupName } via
 * /api/sde/skill-catalog (local SDE only — see resolveSkillCatalog in
 * src/lib/sde/index.ts). Used to render the Character Profile's "Skills
 * treinadas" section grouped by SDE group, and to label skill queue entries.
 */
export function useSkillCatalog(skillIds: number[]) {
  const uniqueIds = Array.from(new Set(skillIds.filter((id) => Number.isFinite(id))))
  const key = uniqueIds.slice().sort((a, b) => a - b).join(',')

  return useQuery({
    queryKey: ['skill-catalog', key],
    queryFn: async () => {
      const res = await fetch('/api/sde/skill-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typeIds: uniqueIds }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: failed to resolve skill catalog`)
      return (await res.json()) as Record<number, SkillTypeCatalogEntry>
    },
    enabled: uniqueIds.length > 0,
    staleTime: 60 * 60 * 1000, // SDE data is effectively static — 1 hour is plenty
  })
}
