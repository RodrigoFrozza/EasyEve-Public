'use client'

import { AlertTriangle, Loader2, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { formatUnits } from '@/lib/pi-v2/format'
import { getCommodityTier } from '@/lib/pi-v2/sde'
import type { SalesBacklogItem } from '@/lib/pi-v2/sales-backlog'
import { PiV2ItemIcon } from './PiV2ItemIcon'
import { TierBadge } from './TierBadge'

/**
 * Backlog de venda de PI (Frente 2) — quanto PI pronto está parado sem virar
 * ISK, somando container de venda designado + contrato próprio ainda em aberto.
 *
 * Não é alerta de urgência: é o sinal que faltava pra decidir "vale construir
 * mais planetas deste item" sem depender de sensação. Sem tendência histórica
 * nesta fatia — só o snapshot de agora.
 */
export function SalesView({
  items,
  incomplete,
  loading,
  error,
  hasContainersConfigured,
}: {
  items?: SalesBacklogItem[]
  incomplete?: boolean
  loading?: boolean
  /** A busca falhou: sem isto a aba ficaria em branco, parecendo backlog vazio. */
  error?: string | null
  /** Nenhum container `role: 'sell'` configurado — não é erro, é config vazia. */
  hasContainersConfigured: boolean
}) {
  const { t } = useTranslations()

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 text-[11px] text-sky-200">
        <ShoppingCart className="mt-px h-3.5 w-3.5 shrink-0" />
        {t('piV2.sales.explainer')}
      </p>

      {/* Aviso, não bloqueio: contrato próprio é lido independente de container
          configurado — sem container, o backlog só fica incompleto (metade do
          sinal), nunca escondido. */}
      {!hasContainersConfigured ? (
        <p className="text-[11px] text-zinc-500">{t('piV2.sales.noContainersConfigured')}</p>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading && !items ? (
        <div className="flex min-h-[120px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-300" />
        </div>
      ) : null}

      {incomplete ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          {t('piV2.sales.incomplete')}
        </p>
      ) : null}

      {items && items.length === 0 && !loading ? (
        <p className="py-8 text-center text-sm text-zinc-500">{t('piV2.sales.empty')}</p>
      ) : null}

      {items && items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="py-1 text-left font-medium">{t('piV2.sales.item')}</th>
                <th className="py-1 text-right font-medium">{t('piV2.sales.inContainer')}</th>
                <th className="py-1 text-right font-medium">{t('piV2.sales.inContract')}</th>
                <th className="py-1 text-right font-medium">{t('piV2.sales.total')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.typeId} className="border-t border-zinc-800/60">
                  <td className="py-1 pr-2">
                    <span className="flex items-center gap-1.5">
                      <PiV2ItemIcon typeId={item.typeId} name={item.name} />
                      <span className="min-w-0 truncate text-zinc-200">{item.name}</span>
                      <TierBadge tier={getCommodityTier(item.typeId)} />
                    </span>
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums text-zinc-400">
                    {formatUnits(item.containerQty)}
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums text-zinc-400">
                    {formatUnits(item.contractQty)}
                  </td>
                  <td
                    className={cn(
                      'py-1 text-right font-medium tabular-nums',
                      item.totalQty > 0 ? 'text-zinc-100' : 'text-zinc-600'
                    )}
                  >
                    {formatUnits(item.totalQty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="text-[10px] text-zinc-600">{t('piV2.sales.footnote')}</p>
    </div>
  )
}
