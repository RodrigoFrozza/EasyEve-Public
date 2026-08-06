'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Input } from '@/components/ui/input'
import { formatIsk, formatM3, formatUnitPrice, formatUnits } from '@/lib/pi-v2/format'
import { marginalRatePerM3, type ContractFreight } from '@/lib/pi-v2/pricing/freight'
import type { FreightHub, FreightLeg, FreightMethod } from '@/lib/pi-v2/pricing/freight-model'
import { PI_JUMP_FREIGHTERS, getJumpFreighter } from '@/lib/pi-v2/jf-data'
import { parseHumanNumber, parsePositiveHumanNumber } from '@/lib/pi-v2/parse-number'
import type { JfPlanInfo } from '@/lib/pi-v2/shopping-types'
import { FieldHelp } from './HelpTip'

/**
 * As pernas de um hub: como a carga vem dele (**entrada**) e como vai até ele
 * (**saída**).
 *
 * O mesmo formulário serve estrutura e fonte pública, porque no modelo elas são a
 * mesma coisa: uma origem com um método e um custo. Era isso que faltava — a
 * Etapa 7 pôs o contrato só nas estruturas e deixou Jita como caixinha de número,
 * o que não bate com quem compra em Jita por contrato de courier.
 *
 * Cada método chega no número por um caminho diferente, então o formulário muda:
 *
 *  - **Courier**: os campos da tabela da transportadora, com os "N/A" preservados
 *    como vazio (não como zero — zero seria um preço).
 *  - **JF próprio**: o casco (isótopo e cargo vêm do SDE) e a quantidade de
 *    isótopos que o DOTLAN calculou. O app anda o book do isótopo, diz onde
 *    abastecer e devolve o ISK/m³ — os números vêm do servidor, no `plan`.
 *
 * **Não existe hub "local".** "Local" quer dizer "não há nada a mover porque eu já
 * estou aqui", e isso só vale na base. Oferecer o botão num hub seria oferecer um
 * frete 0 com a justificativa errada — o zero silencioso que este modelo existe
 * para eliminar.
 *
 * A **saída nasce colapsada**: a maioria vende na própria base, e para essa
 * maioria não há nada a configurar (frete de saída 0, sem precisar dizer).
 */

const METHODS: Array<Extract<FreightMethod, 'courier' | 'jf'>> = ['courier', 'jf']

/**
 * Campo numérico do frete.
 *
 * **Não é `type="number"` de propósito.** Com input numérico o navegador
 * interpreta o separador conforme o locale DELE antes de a gente ver o valor: em
 * pt-BR, `139,314` chegava como `139.314` e o servidor arredondava para 139 — o
 * ISK/m³ do JF saía 1000× errado, calado. Aqui o texto chega cru e
 * `parseHumanNumber` decide o que a pessoa quis dizer.
 *
 * O estado guarda o que foi DIGITADO, não o número: reformatar no meio da digitação
 * move o cursor e faz o campo lutar contra quem escreve.
 */
function NumberField({
  label,
  hint,
  value,
  onChange,
  help,
}: {
  label: string
  hint?: string
  value: number | null | undefined
  onChange: (v: number | null) => void
  help?: { title: string; body: string }
}) {
  const [draft, setDraft] = useState<string | null>(null)
  // Campo vazio = "N/A" da tabela da transportadora. Preservar o vazio é o que
  // distingue "este contrato não tem esse termo" de "custa zero" — e nos campos do
  // JF, "ainda não informei" de "informei zero".
  const shown = draft ?? (value == null || value === 0 ? '' : String(value))
  const invalid = draft != null && draft.trim() !== '' && parseHumanNumber(draft) == null

  return (
    <label className="block">
      <span className="mb-0.5 flex items-center gap-1 truncate text-[11px] text-zinc-400">
        {label}
        {help ? <FieldHelp title={help.title} body={help.body} /> : null}
      </span>
      <Input
        type="text"
        inputMode="decimal"
        value={shown}
        placeholder={hint}
        onChange={(e) => {
          const raw = e.target.value
          setDraft(raw)
          onChange(raw.trim() === '' ? null : parsePositiveHumanNumber(raw))
        }}
        // Ao sair, o campo passa a mostrar o número que o app entendeu. É onde o
        // jogador confere que `139,314` virou 139314 e não 139.
        onBlur={() => setDraft(null)}
        className={cn(
          'h-8 border-zinc-800 bg-zinc-950 text-xs tabular-nums',
          invalid && 'border-amber-500/60'
        )}
      />
    </label>
  )
}

/** A conta do JF, como o servidor a calculou. É o que dá para conferir. */
function JfPlanSummary({ plan }: { plan: JfPlanInfo }) {
  const { t } = useTranslations()
  const priceLine = (label: string, price: number | null, recommended: boolean) => (
    <span className={cn('tabular-nums', recommended ? 'text-emerald-300' : 'text-zinc-500')}>
      {label}: {price != null ? `${formatUnitPrice(price)} ISK` : t('piV2.shopping.jf.noPrice')}
    </span>
  )

  return (
    <div className="space-y-1 rounded border border-zinc-800/60 bg-zinc-950 p-2 text-[11px]">
      <p className="text-zinc-400">
        {plan.isotopeName} · {formatUnits(plan.isotopeQtyRoundTrip)}{' '}
        {t('piV2.shopping.jf.unitsRoundTrip')}
      </p>
      <p className="flex flex-wrap items-center gap-x-3">
        {priceLine(t('piV2.shopping.jf.atOrigin'), plan.originPrice, plan.adviseAt === 'origin')}
        {priceLine(
          t('piV2.shopping.jf.atDestination'),
          plan.destinationPrice,
          plan.adviseAt === 'destination'
        )}
      </p>
      {plan.originPrice != null && plan.destinationPrice != null ? (
        <p className="text-emerald-300">
          {t(
            plan.adviseAt === 'origin'
              ? 'piV2.shopping.jf.refuelAtOrigin'
              : 'piV2.shopping.jf.refuelAtDestination'
          )}
          {plan.savingsPerTrip > 0
            ? ` · ${t('piV2.shopping.jf.savings', { isk: formatIsk(plan.savingsPerTrip) })}`
            : ''}
        </p>
      ) : null}
      {plan.refuelAt !== plan.adviseAt ? (
        // Ele escolheu na mão o lado mais caro. Não sobrescrevemos a escolha dele,
        // mas a conta mostrada é a da escolha — e o aviso fica.
        <p className="text-amber-300">{t('piV2.shopping.jf.overridingAdvice')}</p>
      ) : null}
      {plan.fuelCostPerTrip != null ? (
        <p className="tabular-nums text-zinc-300">
          {t('piV2.shopping.jf.fuelPerTrip', { isk: formatIsk(plan.fuelCostPerTrip) })} ÷{' '}
          {formatM3(plan.loadM3)} m³ ={' '}
          <strong>
            {plan.ratePerM3 != null ? formatUnitPrice(plan.ratePerM3) : '—'} ISK/m³
          </strong>
        </p>
      ) : (
        // Sem book do isótopo o combustível é desconhecido. Não vira 0: o custo
        // do hub herda a incerteza e a tela diz por quê.
        <p className="text-amber-300">{t('piV2.shopping.jf.noIsotopePrice')}</p>
      )}
    </div>
  )
}

/**
 * Editor de UMA perna. Serve entrada e saída sem diferença: o trajeto muda, o
 * jeito de chegar no ISK/m³ não.
 */
function LegEditor({
  hubId,
  leg: rawLeg,
  plan,
  onChange,
  onRememberContract,
  onRecallContract,
}: {
  hubId: string
  leg?: FreightLeg
  plan?: JfPlanInfo
  onChange: (leg: FreightLeg | undefined) => void
  onRememberContract: (hubId: string, contract: ContractFreight) => void
  onRecallContract: (hubId: string, transporter: string) => ContractFreight | undefined
}) {
  const { t } = useTranslations()
  // Perna `local` num hub é tratada como ausente: nunca foi válida (só a base é
  // local), e config gravada antes do fix ainda pode trazê-la. Sem isto o
  // formulário renderizaria vazio, sem método selecionado e sem rótulo.
  const leg = rawLeg?.method === 'local' ? undefined : rawLeg
  const method = leg?.method
  // O `method` sai do contrato: o que vai para a memória de contratos são os
  // termos da transportadora, não o método da perna — a mesma tabela da ITL vale
  // para qualquer rota onde ele contrate.
  const courier: ContractFreight =
    leg?.method === 'courier'
      ? {
          transporter: leg.transporter,
          perM3Rate: leg.perM3Rate,
          fullLoadReward: leg.fullLoadReward,
          fullLoadVolumeM3: leg.fullLoadVolumeM3,
          collateralRate: leg.collateralRate,
          minReward: leg.minReward,
        }
      : { transporter: '' }
  const marginal = leg?.method === 'courier' ? marginalRatePerM3(leg) : null

  const setMethod = (next: (typeof METHODS)[number]) => {
    if (next === method) return
    if (next === 'courier') return onChange({ method: 'courier', ...courier })
    // JF: começa no primeiro casco e no cargo dele, para o campo nunca nascer
    // vazio — o jogador ajusta a carga real se não enche.
    const first = PI_JUMP_FREIGHTERS[0]!
    onChange({
      method: 'jf',
      jfTypeId: first.typeId,
      isotopeQtyRoundTrip: 0,
      cargoM3: first.cargoM3,
    })
  }

  const patchCourier = (patch: Partial<ContractFreight>) => {
    const next = { ...courier, ...patch }
    onChange({ method: 'courier', ...next })
    onRememberContract(hubId, next)
  }

  /** Trocar de transportadora recupera o que já foi digitado para ela nesta rota. */
  const setTransporter = (transporter: string) => {
    const remembered = onRecallContract(hubId, transporter)
    const next = remembered ? { ...remembered, transporter } : { ...courier, transporter }
    onChange({ method: 'courier', ...next })
  }

  const patchJf = (patch: Partial<Extract<FreightLeg, { method: 'jf' }>>) => {
    if (leg?.method !== 'jf') return
    onChange({ ...leg, ...patch })
  }

  return (
    <div className="space-y-2 rounded border border-zinc-800/60 bg-zinc-950/60 p-2">
      <div className="flex flex-wrap items-center gap-1">
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={method === m}
            onClick={() => setMethod(m)}
            className={cn(
              'rounded px-2 py-1 text-[11px] transition-colors',
              method === m
                ? 'bg-violet-500/20 text-violet-200'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200'
            )}
          >
            {t(`piV2.shopping.freightMode.${m}`)}
          </button>
        ))}
        {method == null ? (
          <span className="text-[11px] text-amber-300">
            {t('piV2.shopping.hubs.notConfigured')}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="ml-auto rounded px-1.5 py-1 text-[10px] text-zinc-500 transition-colors hover:text-red-300"
          >
            {t('piV2.shopping.hubs.clearLeg')}
          </button>
        )}
      </div>

      {method == null ? (
        <p className="text-[11px] text-zinc-500">{t('piV2.shopping.hubs.pickMethod')}</p>
      ) : null}

      {method === 'courier' ? (
        <>
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-zinc-400">
              {t('piV2.shopping.contract.transporter')}
            </span>
            <Input
              value={courier.transporter}
              onChange={(e) => setTransporter(e.target.value)}
              placeholder="GDSO, ITL…"
              className="h-8 border-zinc-800 bg-zinc-950 text-xs"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <NumberField
              label={t('piV2.shopping.contract.perM3')}
              help={{
                title: t('piV2.shopping.contract.perM3'),
                body: t('piV2.shopping.fieldHelp.perM3'),
              }}
              hint={t('piV2.shopping.contract.naFlatOnly')}
              value={courier.perM3Rate}
              onChange={(v) => patchCourier({ perM3Rate: v })}
            />
            <NumberField
              label={t('piV2.shopping.contract.minReward')}
              help={{
                title: t('piV2.shopping.contract.minReward'),
                body: t('piV2.shopping.fieldHelp.minReward'),
              }}
              hint={t('piV2.shopping.contract.na')}
              value={courier.minReward}
              onChange={(v) => patchCourier({ minReward: v })}
            />
            <NumberField
              label={t('piV2.shopping.contract.fullLoad')}
              help={{
                title: t('piV2.shopping.contract.fullLoad'),
                body: t('piV2.shopping.fieldHelp.fullLoad'),
              }}
              hint={t('piV2.shopping.contract.na')}
              value={courier.fullLoadReward}
              onChange={(v) => patchCourier({ fullLoadReward: v })}
            />
            <NumberField
              label={t('piV2.shopping.contract.fullLoadVolume')}
              help={{
                title: t('piV2.shopping.contract.fullLoadVolume'),
                body: t('piV2.shopping.fieldHelp.fullLoadVolume'),
              }}
              hint={t('piV2.shopping.contract.na')}
              value={courier.fullLoadVolumeM3}
              onChange={(v) => patchCourier({ fullLoadVolumeM3: v })}
            />
            <NumberField
              label={t('piV2.shopping.contract.collateralRate')}
              help={{
                title: t('piV2.shopping.contract.collateralRate'),
                body: t('piV2.shopping.fieldHelp.collateralRate'),
              }}
              hint={t('piV2.shopping.contract.naUseVolume')}
              value={courier.collateralRate}
              onChange={(v) => patchCourier({ collateralRate: v })}
            />
          </div>

          <p className="text-[11px] text-zinc-400">
            {marginal != null ? (
              <>
                {t('piV2.shopping.contract.effectiveRate')}{' '}
                <strong className="tabular-nums text-zinc-200">
                  {formatUnitPrice(marginal)} ISK/m³
                </strong>
              </>
            ) : (
              // Sem per m³ e sem o volume da carga cheia, não dá para dizer quanto
              // do frete cabe a cada item — e não inventamos uma taxa.
              <span className="text-amber-300">{t('piV2.shopping.contract.noMarginal')}</span>
            )}
          </p>
        </>
      ) : null}

      {leg?.method === 'jf' ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-0.5 block text-[11px] text-zinc-400">
                {t('piV2.shopping.jf.hull')}
              </span>
              <select
                value={leg.jfTypeId}
                onChange={(e) => {
                  const jfTypeId = Number(e.target.value)
                  const jf = getJumpFreighter(jfTypeId)
                  // Trocar de casco reajusta a carga para o cargo do novo casco
                  // quando ela estava no default do anterior: o cargo é do SDE, e
                  // manter o número velho seria mentir sobre a nave escolhida.
                  const wasDefault = getJumpFreighter(leg.jfTypeId)?.cargoM3 === leg.cargoM3
                  patchJf({
                    jfTypeId,
                    cargoM3: wasDefault && jf ? jf.cargoM3 : leg.cargoM3,
                  })
                }}
                className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200"
              >
                {PI_JUMP_FREIGHTERS.map((jf) => (
                  <option key={jf.typeId} value={jf.typeId}>
                    {jf.name} · {formatM3(jf.cargoM3)} m³ · {jf.isotopeName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-0.5 block text-[11px] text-zinc-400">
                {t('piV2.shopping.jf.refuel')}
              </span>
              <select
                value={leg.refuelAt ?? 'auto'}
                onChange={(e) => {
                  const v = e.target.value
                  patchJf({ refuelAt: v === 'auto' ? undefined : (v as 'origin' | 'destination') })
                }}
                className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200"
              >
                <option value="auto">{t('piV2.shopping.jf.refuelAuto')}</option>
                <option value="origin">{t('piV2.shopping.jf.refuelOrigin')}</option>
                <option value="destination">{t('piV2.shopping.jf.refuelDestination')}</option>
              </select>
            </label>

            <NumberField
              label={t('piV2.shopping.jf.isotopeQty')}
              help={{
                title: t('piV2.shopping.jf.isotopeQty'),
                body: t('piV2.shopping.fieldHelp.isotopeQty'),
              }}
              hint={t('piV2.shopping.jf.isotopeQtyHint')}
              value={leg.isotopeQtyRoundTrip}
              onChange={(v) => patchJf({ isotopeQtyRoundTrip: v ?? 0 })}
            />
            <NumberField
              label={t('piV2.shopping.jf.load')}
              help={{
                title: t('piV2.shopping.jf.load'),
                body: t('piV2.shopping.fieldHelp.load'),
              }}
              hint={String(getJumpFreighter(leg.jfTypeId)?.cargoM3 ?? '')}
              value={leg.cargoM3}
              onChange={(v) => patchJf({ cargoM3: v ?? 0 })}
            />
          </div>

          {leg.isotopeQtyRoundTrip > 0 ? (
            plan ? (
              <JfPlanSummary plan={plan} />
            ) : (
              <p className="text-[11px] text-zinc-500">{t('piV2.shopping.jf.pending')}</p>
            )
          ) : (
            <p className="text-[11px] text-amber-300">{t('piV2.shopping.jf.needQty')}</p>
          )}
        </>
      ) : null}
    </div>
  )
}

export function HubFreightForm({
  hub,
  plans,
  onChange,
  onRememberContract,
  onRecallContract,
}: {
  hub: FreightHub
  /** As contas de JF deste hub, por direção. Ausentes até a primeira resposta. */
  plans?: JfPlanInfo[]
  onChange: (next: FreightHub) => void
  onRememberContract: (hubId: string, contract: ContractFreight) => void
  onRecallContract: (hubId: string, transporter: string) => ContractFreight | undefined
}) {
  const { t } = useTranslations()
  // Nasce aberta só quando já há saída configurada: quem vende na base (a maioria)
  // não tem nada a fazer aqui.
  const [showOutbound, setShowOutbound] = useState(hub.outbound != null)

  const planFor = (direction: 'inbound' | 'outbound') =>
    plans?.find((p) => p.direction === direction)

  return (
    <div className="space-y-2">
      <LegEditor
        hubId={hub.id}
        leg={hub.inbound}
        plan={planFor('inbound')}
        onChange={(inbound) => onChange({ ...hub, inbound })}
        onRememberContract={onRememberContract}
        onRecallContract={onRecallContract}
      />

      <div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-expanded={showOutbound}
            onClick={() => setShowOutbound((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-violet-300"
          >
            {showOutbound ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {t('piV2.shopping.hubs.outboundTitle')}
            {hub.outbound == null ? (
              <span className="text-zinc-600">· {t('piV2.shopping.hubs.outboundNone')}</span>
            ) : null}
          </button>
          <FieldHelp
            title={t('piV2.shopping.hubs.outboundTitle')}
            body={t('piV2.shopping.fieldHelp.outbound')}
          />
        </div>

        {showOutbound ? (
          <div className="mt-1.5 space-y-1.5">
            <p className="text-[11px] text-zinc-500">{t('piV2.shopping.hubs.outboundHelp')}</p>
            <LegEditor
              hubId={hub.id}
              leg={hub.outbound}
              plan={planFor('outbound')}
              onChange={(outbound) => onChange({ ...hub, outbound })}
              onRememberContract={onRememberContract}
              onRecallContract={onRecallContract}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
