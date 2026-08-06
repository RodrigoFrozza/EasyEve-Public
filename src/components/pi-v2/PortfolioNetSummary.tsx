'use client'

import { AlertTriangle, Coins, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { formatIsk } from '@/lib/pi-v2/format'
import type { PnlTotals } from '@/lib/pi-v2/pnl'

/**
 * O NET do portfólio — o número que responde "quanto meu PI rende".
 *
 * É a **soma dos NET por colônia**, não uma segunda conta sobre o portfólio: se
 * divergisse, o topo da tela contradiria o detalhe que o jogador abre para
 * conferir.
 *
 * Mostra o dia e o mês ao lado da hora porque é assim que a decisão é tomada (a
 * auditoria do Rodrigo é mensal), mas a base é sempre ISK/h — projetar 30 dias de
 * uma taxa instantânea é uma extrapolação, e a tela diz isso no rodapé.
 */

const HOURS_PER_DAY = 24
/** Mês comercial de 30 dias. Rótulo explícito para ninguém confundir com o calendário. */
const DAYS_PER_MONTH = 30

function Term({ label, value, tone }: { label: string; value: string; tone: 'positive' | 'negative' }) {
  return (
    <span className="flex items-baseline gap-1 text-[11px]">
      <span className="text-zinc-500">{label}</span>
      <span
        className={cn(
          'tabular-nums',
          tone === 'positive' ? 'text-emerald-300/90' : 'text-orange-300/80'
        )}
      >
        {value}
      </span>
    </span>
  )
}

export function PortfolioNetSummary({
  totals,
  loading,
  error,
}: {
  totals?: PnlTotals
  loading?: boolean
  error?: string | null
}) {
  const { t } = useTranslations()

  if (error) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] text-zinc-500">
        {t('piV2.pnl.totalsUnavailable')}
      </div>
    )
  }

  if (!totals) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] text-zinc-500">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" /> : null}
        {t('piV2.pnl.totalsLoading')}
      </div>
    )
  }

  const net = totals.netPerHour

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
          <Coins className="h-3 w-3" />
          {t('piV2.pnl.portfolioNet')}
        </span>
        <span
          className={cn(
            'text-xl font-bold tabular-nums',
            net >= 0 ? 'text-emerald-300' : 'text-orange-300'
          )}
        >
          {formatIsk(net)}/h
        </span>
        <span className="text-xs tabular-nums text-zinc-400">
          {formatIsk(net * HOURS_PER_DAY)}/{t('piV2.pnl.day')}
        </span>
        <span className="text-xs tabular-nums text-zinc-500">
          {formatIsk(net * HOURS_PER_DAY * DAYS_PER_MONTH)}/{t('piV2.pnl.month')}
        </span>
        <span className="text-[11px] text-zinc-600">
          {t('piV2.pnl.colonies', { count: totals.colonyCount })}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Term
          label={t('piV2.pnl.revenue')}
          value={`+${formatIsk(totals.exportGrossPerHour)}`}
          tone="positive"
        />
        <Term
          label={t('piV2.pnl.exportTax')}
          value={`−${formatIsk(totals.exportTaxPerHour)}`}
          tone="negative"
        />
        <Term
          label={t('piV2.pnl.inputCost')}
          value={`−${formatIsk(totals.inputCostPerHour)}`}
          tone="negative"
        />
        <Term
          label={t('piV2.pnl.importTax')}
          value={`−${formatIsk(totals.importTaxPerHour)}`}
          tone="negative"
        />
        {totals.outboundFreightPerHour > 0 ? (
          <Term
            label={t('piV2.pnl.outboundFreightShort')}
            value={`−${formatIsk(totals.outboundFreightPerHour)}`}
            tone="negative"
          />
        ) : null}
      </div>

      {totals.coloniesWithUnpriced > 0 ? (
        // O agregado herda a incerteza das partes: se uma colônia tem item sem
        // preço, o total não é o total.
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-300/90">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          {t('piV2.pnl.totalsIncomplete', { count: totals.coloniesWithUnpriced })}
        </p>
      ) : null}

      <p className="mt-1 text-[10px] text-zinc-600">{t('piV2.pnl.totalsFootnote')}</p>
    </div>
  )
}
