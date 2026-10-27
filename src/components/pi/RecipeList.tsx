'use client'

import type { PiColonyAnalysis, PiRecipeView } from '@/lib/pi/types'
import { useTranslations } from '@/i18n/hooks'
import { formatCompactNumber } from '@/lib/utils'
import { formatPiRate } from '@/lib/pi/format'

type Props = {
  colony: PiColonyAnalysis
  rateMode: 'potential' | 'current'
}

function recipeOutputPerHour(
  recipe: PiRecipeView,
  colony: PiColonyAnalysis,
  rateMode: 'potential' | 'current'
): number {
  if (rateMode === 'potential') return recipe.designedOutputPerHour
  const balance = colony.balances.current.find((b) => b.typeId === recipe.output.typeId)
  return balance?.productionPerHour ?? 0
}

export function RecipeList({ colony, rateMode }: Props) {
  const { t } = useTranslations()
  const { recipes } = colony
  if (recipes.length === 0) return null

  return (
    <section className="space-y-3">
      <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-violet-300">
        {t('pi.recipes.title')}
      </h4>
      <div className="space-y-2">
        {recipes.map((recipe) => {
          const outputPerHour = recipeOutputPerHour(recipe, colony, rateMode)
          return (
            <div
              key={`${recipe.schematicId}-${recipe.pinId}`}
              className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-zinc-200">{recipe.name}</p>
                <p className="text-xs text-zinc-500">
                  {t('pi.recipes.cycle')}: {Math.round(recipe.cycleTimeSec / 60)}m ·{' '}
                  {formatPiRate(outputPerHour)}/h
                  {rateMode === 'current' &&
                  outputPerHour < recipe.designedOutputPerHour ? (
                    <span className="ml-1 text-amber-400">
                      ({t('pi.recipes.max')} {formatPiRate(recipe.designedOutputPerHour)}/h)
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase text-zinc-500">
                    {t('pi.recipes.inputs')}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-zinc-300">
                    {recipe.inputs.map((inp) => (
                      <li key={inp.typeId}>
                        {formatCompactNumber(inp.qty)} × {inp.name}
                        {inp.tier != null ? ` (P${inp.tier})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-zinc-500">
                    {t('pi.recipes.output')}
                  </p>
                  <p className="mt-1 text-xs text-emerald-300">
                    {formatCompactNumber(recipe.output.qty)} × {recipe.output.name}
                    {recipe.output.tier != null ? ` (P${recipe.output.tier})` : ''}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
