'use client'

import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { formatIsk, formatUnitPrice } from '@/lib/pi-v2/format'
import { formatPiRate } from '@/lib/pi/format'
import type { ColonyPnl, PnlLine } from '@/lib/pi-v2/pnl'
import { FieldHelp, HelpTip } from './HelpTip'
import { PiV2ItemIcon } from './PiV2ItemIcon'
import { TierBadge } from './TierBadge'

/**
 * P&L da colônia — a resposta a "quanto isso rende".
 *
 * A tela mostra a **decomposição**, não só o total, pela mesma razão da lista de
 * compra: um número de ISK/h sem a conta atrás não dá para conferir, e este modelo
 * foi construído sendo conferido contra auditoria manual.
 *
 * Dois cuidados que a tela é obrigada a ter:
 *
 *  - **O NET é projeção.** Herda o selo de idade da colônia; o cabeçalho do
 *    detalhe já o carrega, e o rodapé aqui repete que os números seguem a mesma
 *    incerteza.
 *  - **Item sem preço deixa o NET incompleto**, e para os DOIS lados: receita não
 *    atribuível o subestima, custo não atribuível o infla. Mostrar o número sem
 *    dizer isso seria o número otimista que a regra de ouro proíbe.
 */

const EMPTY = '—'

function Row({
  label,
  value,
  help,
  tone = 'neutral',
  strong = false,
}: {
  label: string
  value: string
  /** Uma frase explicando a linha — a dúvida 9, respondida onde ela aparece. */
  help?: string
  tone?: 'neutral' | 'positive' | 'negative'
  strong?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 py-0.5',
        strong && 'border-t border-zinc-700 pt-1.5 mt-1'
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1 text-[11px]',
          strong ? 'font-semibold text-zinc-200' : 'text-zinc-400'
        )}
      >
        {label}
        {help ? <FieldHelp title={label} body={help} /> : null}
      </span>
      <span
        className={cn(
          'shrink-0 tabular-nums',
          strong ? 'text-sm font-bold' : 'text-[11px]',
          tone === 'positive' && 'text-emerald-300',
          tone === 'negative' && 'text-orange-300/90',
          tone === 'neutral' && (strong ? 'text-zinc-100' : 'text-zinc-300')
        )}
      >
        {value}
      </span>
    </div>
  )
}

function LineTable({
  lines,
  title,
  showHub,
}: {
  lines: PnlLine[]
  title: string
  showHub?: boolean
}) {
  const { t } = useTranslations()
  if (lines.length === 0) return null

  return (
    <div>
      <p className="mb-1 mt-2 text-[10px] font-bold uppercase tracking-wider text-violet-300">
        {title}
      </p>
      <table className="w-full text-[11px]">
        <tbody>
          {lines.map((line) => (
            <tr key={line.typeId} className="border-t border-zinc-800/60">
              <td className="py-0.5 pr-2 text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <PiV2ItemIcon typeId={line.typeId} name={line.name} size={16} />
                  <span className="min-w-0 truncate">{line.name}</span>
                  <TierBadge tier={line.tier} />
                </span>
              </td>
              <td className="py-0.5 pr-2 text-right tabular-nums text-zinc-500">
                {formatPiRate(line.unitsPerHour)}/h
              </td>
              <td className="py-0.5 pr-2 text-right tabular-nums text-zinc-400">
                {formatUnitPrice(line.unitPrice)}
              </td>
              {showHub ? (
                <td className="py-0.5 pr-2 text-right text-[10px] text-zinc-600">
                  <span className="block max-w-[9rem] truncate">{line.hubLabel ?? EMPTY}</span>
                </td>
              ) : null}
              <td className="py-0.5 text-right tabular-nums text-zinc-300">
                {formatIsk(line.grossPerHour)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showHub ? (
        <p className="mt-1 text-[10px] text-zinc-600">{t('piV2.pnl.hubNote')}</p>
      ) : null}
    </div>
  )
}

export function ColonyPnlPanel({
  pnl,
  designed,
  sellHubName,
  sellsAtBase,
}: {
  /** A visão honesta: o que a colônia rende AGORA. */
  pnl: ColonyPnl
  /** O alvo, se tudo estivesse no lugar. A diferença é o custo de não visitar. */
  designed?: ColonyPnl
  sellHubName?: string | null
  sellsAtBase: boolean
}) {
  const { t } = useTranslations()

  const incomplete =
    pnl.unpricedExportTypeIds.length > 0 || pnl.unpricedInputTypeIds.length > 0
  const gap = designed ? designed.netPerHour - pnl.netPerHour : 0

  return (
    <div className="space-y-1">
      {/* A legenda do bloco: o que este número é, em duas frases. */}
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
          {t('piV2.pnl.perHourTitle')}
        </span>
        <HelpTip title={t('piV2.pnl.title')}>
          <p>{t('piV2.pnl.help')}</p>
        </HelpTip>
      </div>

      <Row
        label={t('piV2.pnl.revenue')}
        value={`+${formatIsk(pnl.exportGrossPerHour)}`}
        help={t('piV2.pnl.rowHelp.revenue')}
        tone="positive"
      />
      <Row
        label={t('piV2.pnl.exportTax')}
        value={`−${formatIsk(pnl.exportTaxPerHour)}`}
        help={t('piV2.pnl.rowHelp.exportTax')}
        tone="negative"
      />
      <Row
        label={t('piV2.pnl.inputCost')}
        value={`−${formatIsk(pnl.inputCostPerHour)}`}
        help={t('piV2.pnl.rowHelp.inputCost')}
        tone="negative"
      />
      <Row
        label={t('piV2.pnl.importTax')}
        value={`−${formatIsk(pnl.importTaxPerHour)}`}
        help={t('piV2.pnl.rowHelp.importTax')}
        tone="negative"
      />
      {/* Só aparece quando existe: uma linha de 0 para quem vende na base é ruído. */}
      {pnl.outboundFreightPerHour > 0 ? (
        <Row
          label={t('piV2.pnl.outboundFreight', { hub: sellHubName ?? '' })}
          value={`−${formatIsk(pnl.outboundFreightPerHour)}`}
          help={t('piV2.pnl.rowHelp.outboundFreight')}
          tone="negative"
        />
      ) : null}

      <Row
        label={t('piV2.pnl.net')}
        value={`${formatIsk(pnl.netPerHour)}/h`}
        help={t('piV2.pnl.rowHelp.net')}
        tone={pnl.netPerHour >= 0 ? 'positive' : 'negative'}
        strong
      />
      <p className="text-right text-[10px] text-zinc-500">
        {t('piV2.pnl.perDay', { isk: formatIsk(pnl.netPerHour * 24) })}
      </p>

      {designed && gap > 0 ? (
        // A diferença entre o alvo e o agora é exatamente o que se perde por não
        // ter visitado a colônia — o número que faz o jogador ir lá.
        <p className="text-[11px] text-amber-300/90">
          {t('piV2.pnl.gap', {
            isk: formatIsk(gap),
            designed: formatIsk(designed.netPerHour),
          })}
        </p>
      ) : null}

      {sellsAtBase ? (
        <p className="text-[10px] text-zinc-600">{t('piV2.pnl.sellsAtBase')}</p>
      ) : (
        <p className="text-[10px] text-zinc-600">
          {t('piV2.pnl.sellsAt', { hub: sellHubName ?? '' })}
        </p>
      )}

      {incomplete ? (
        <p className="flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            {t('piV2.pnl.incomplete', {
              revenue: pnl.unpricedExportTypeIds.length,
              cost: pnl.unpricedInputTypeIds.length,
            })}
          </span>
        </p>
      ) : null}

      <LineTable lines={pnl.exportLines} title={t('piV2.pnl.exportLines')} />
      <LineTable lines={pnl.inputLines} title={t('piV2.pnl.inputLines')} showHub />

      <p className="mt-1.5 text-[10px] text-zinc-600">{t('piV2.pnl.footnote')}</p>
    </div>
  )
}
