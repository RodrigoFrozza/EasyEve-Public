'use client'

import { useQuery } from '@tanstack/react-query'

/**
 * Batch-resolves EVE type IDs to their SDE name via /api/sde/resolve-types
 * (local DB first, ESI fallback — see resolveTypeNames in src/lib/sde/index.ts).
 * Used for anything that only needs a display name (e.g. implants) — for
 * skills, which also need their SDE group for the "Skills treinadas" grouping,
 * use useSkillCatalog instead.
 */
export function useTypeNames(typeIds: number[]) {
  const uniqueIds = Array.from(new Set(typeIds.filter((id) => Number.isFinite(id))))
  const key = uniqueIds.slice().sort((a, b) => a - b).join(',')

  return useQuery({
    queryKey: ['type-names', key],
    queryFn: async () => {
      const res = await fetch('/api/sde/resolve-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typeIds: uniqueIds }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: failed to resolve type names`)
      return (await res.json()) as Record<number, string>
    },
    enabled: uniqueIds.length > 0,
    staleTime: 60 * 60 * 1000, // SDE names are effectively static — 1 hour is plenty
  })
}
