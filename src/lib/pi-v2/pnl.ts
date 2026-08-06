/**
 * P&L por colônia — quanto ela rende, líquido, por hora.
 *
 * A conta:
 *
 *     NET/h = receita de export
 *           − imposto de export (POCO)
 *           − custo de insumo (mercadoria + frete de ENTRADA)
 *           − imposto de import (POCO)
 *           − frete de SAÍDA (0 quando vende na base)
 *
 * Três regras que este arquivo existe para cumprir:
 *
 *  1. **Não recalcular preço nem escolher hub aqui.** O custo unitário do insumo
 *     entra pronto, vindo da MESMA função que a lista de compra usa
 *     (`quoteHubs`/`chooseHub`). Se o P&L escolhesse um hub e a lista outro, a tela
 *     mandaria comprar num lugar e contabilizaria noutro.
 *  2. **Imposto de alfândega é sobre o valor-base por tier**, não sobre o mercado
 *     (`customs.ts`). Import é metade do export.
 *  3. **Sem preço não há receita atribuível.** Commodity exportada sem book de
 *     venda sai numa lista de avisos e **não entra no NET** — nem como 0 otimista,
 *     nem como estimativa. O mesmo vale para insumo sem hub: o custo aparece como
 *     não atribuível em vez de virar lucro.
 *
 * A regra 3 tem uma consequência que a tela precisa dizer: um NET com itens não
 * precificados é **incompleto para os dois lados**, e o número mostrado é o do que
 * se sabe. Zerar para cima (receita sem custo) seria o pior dos mundos.
 *
 * Puro: nenhuma dependência de servidor. Recebe funções de preço e devolve números.
 */

import { customsTaxPerHour } from '@/lib/pi-v2/pricing/customs'
import type { CommodityBalance } from '@/lib/pi-v2/demand'
import type { PiCommodityTier } from '@/lib/pi-v2/sde'

/** Uma linha da decomposição — o que a tela mostra para dar para conferir. */
export interface PnlLine {
  typeId: number
  name: string
  tier?: PiCommodityTier
  unitsPerHour: number
  /** Preço unitário usado. No insumo é o EFETIVO (mercadoria + frete de entrada). */
  unitPrice: number
  /** `unitsPerHour × unitPrice`. */
  grossPerHour: number
  /** Imposto de alfândega desta linha, sobre o valor-base do tier. */
  taxPerHour: number
  /** Hub de compra escolhido (só nas linhas de insumo) — o mesmo da lista. */
  hubKey?: string
  hubLabel?: string
}

export interface ColonyPnl {
  /** Receita bruta de venda, antes do imposto. */
  exportGrossPerHour: number
  exportTaxPerHour: number
  /** Mercadoria + frete de ENTRADA dos insumos comprados. */
  inputCostPerHour: number
  importTaxPerHour: number
  /** Levar o produto da base até o hub de venda. 0 quando vende no lugar. */
  outboundFreightPerHour: number
  /** O número da tela. */
  netPerHour: number
  /** Volume exportado por hora, m³ — a base do frete de saída. */
  exportVolumeM3PerHour: number
  exportLines: PnlLine[]
  inputLines: PnlLine[]
  /** Exportado sem preço de venda: receita NÃO atribuível (fora do NET). */
  unpricedExportTypeIds: number[]
  /** Insumo sem hub/preço: custo NÃO atribuível (fora do NET). */
  unpricedInputTypeIds: number[]
}

/** O custo unitário de um insumo, como a lista de compra o resolveu. */
export interface InputCostQuote {
  /** `preço andado + frete de entrada por unidade`. É por este número que se paga. */
  effectiveUnitPrice: number
  hubKey?: string
  hubLabel?: string
}

export interface ComputeColonyPnlInput {
  /**
   * A visão que se está precificando. `current` é o número honesto (limitado pela
   * extração real); `designed` é o alvo. O chamador decide e a tela rotula.
   */
  balances: CommodityBalance[]
  /** Preço de venda unitário. 0/ausente = sem book: não inventa. */
  sellUnitPrice: (typeId: number) => number
  /** Custo unitário efetivo do insumo, da mesma cotação da lista de compra. */
  inputCost: (typeId: number) => InputCostQuote | null
  /** m³ por unidade, do SDE. */
  volumePerUnit: (typeId: number) => number
  exportTaxRate: number
  importTaxRate: number
  /** ISK/m³ da base até o hub de venda. 0 = vende no lugar. */
  outboundRatePerM3: number
}

export function computeColonyPnl(input: ComputeColonyPnlInput): ColonyPnl {
  const {
    balances,
    sellUnitPrice,
    inputCost,
    volumePerUnit,
    exportTaxRate,
    importTaxRate,
    outboundRatePerM3,
  } = input

  const exportLines: PnlLine[] = []
  const inputLines: PnlLine[] = []
  const unpricedExportTypeIds: number[] = []
  const unpricedInputTypeIds: number[] = []

  let exportGrossPerHour = 0
  let exportTaxPerHour = 0
  let inputCostPerHour = 0
  let importTaxPerHour = 0
  let exportVolumeM3PerHour = 0

  for (const balance of balances) {
    // ---- VENDA: só o que de fato foi roteado até um store terminal ----
    if (balance.exportedPerHour > 0) {
      const units = balance.exportedPerHour
      const price = sellUnitPrice(balance.typeId)

      if (price > 0) {
        const gross = units * price
        // O imposto acompanha a receita: taxar uma linha sem preço mostraria uma
        // taxa de alfândega sem nada por trás dela.
        const tax = customsTaxPerHour(units, balance.typeId, exportTaxRate)
        exportGrossPerHour += gross
        exportTaxPerHour += tax
        // O volume só entra no frete de saída quando a venda é atribuível: mover
        // carga que não sabemos vender não é um custo que se possa afirmar.
        exportVolumeM3PerHour += units * volumePerUnit(balance.typeId)
        exportLines.push({
          typeId: balance.typeId,
          name: balance.name,
          tier: balance.tier,
          unitsPerHour: units,
          unitPrice: price,
          grossPerHour: gross,
          taxPerHour: tax,
        })
      } else {
        unpricedExportTypeIds.push(balance.typeId)
      }
    }

    // ---- INSUMO: mercadoria + frete de entrada, no hub que a lista escolheu ----
    if (balance.importNeededPerHour > 0) {
      const units = balance.importNeededPerHour
      const quote = inputCost(balance.typeId)

      if (quote && quote.effectiveUnitPrice > 0) {
        const material = units * quote.effectiveUnitPrice
        const tax = customsTaxPerHour(units, balance.typeId, importTaxRate, { isImport: true })
        inputCostPerHour += material
        importTaxPerHour += tax
        inputLines.push({
          typeId: balance.typeId,
          name: balance.name,
          tier: balance.tier,
          unitsPerHour: units,
          unitPrice: quote.effectiveUnitPrice,
          grossPerHour: material,
          taxPerHour: tax,
          hubKey: quote.hubKey,
          hubLabel: quote.hubLabel,
        })
      } else {
        // Insumo sem hub nem preço. NÃO entra como 0: isso viraria lucro que não
        // existe. Sai rotulado, e a tela diz que o NET está incompleto.
        unpricedInputTypeIds.push(balance.typeId)
      }
    }
  }

  const outboundFreightPerHour = exportVolumeM3PerHour * Math.max(0, outboundRatePerM3)

  exportLines.sort((a, b) => b.grossPerHour - a.grossPerHour)
  inputLines.sort((a, b) => b.grossPerHour - a.grossPerHour)

  return {
    exportGrossPerHour,
    exportTaxPerHour,
    inputCostPerHour,
    importTaxPerHour,
    outboundFreightPerHour,
    netPerHour:
      exportGrossPerHour -
      exportTaxPerHour -
      inputCostPerHour -
      importTaxPerHour -
      outboundFreightPerHour,
    exportVolumeM3PerHour,
    exportLines,
    inputLines,
    unpricedExportTypeIds,
    unpricedInputTypeIds,
  }
}

/** Totais do portfólio: a soma dos por-colônia, sem recontar nada. */
export interface PnlTotals {
  colonyCount: number
  exportGrossPerHour: number
  exportTaxPerHour: number
  inputCostPerHour: number
  importTaxPerHour: number
  outboundFreightPerHour: number
  netPerHour: number
  /** Quantas colônias têm algum item sem preço — o NET agregado é incompleto. */
  coloniesWithUnpriced: number
}

export function sumPnl(entries: ColonyPnl[]): PnlTotals {
  const totals: PnlTotals = {
    colonyCount: entries.length,
    exportGrossPerHour: 0,
    exportTaxPerHour: 0,
    inputCostPerHour: 0,
    importTaxPerHour: 0,
    outboundFreightPerHour: 0,
    netPerHour: 0,
    coloniesWithUnpriced: 0,
  }
  for (const pnl of entries) {
    totals.exportGrossPerHour += pnl.exportGrossPerHour
    totals.exportTaxPerHour += pnl.exportTaxPerHour
    totals.inputCostPerHour += pnl.inputCostPerHour
    totals.importTaxPerHour += pnl.importTaxPerHour
    totals.outboundFreightPerHour += pnl.outboundFreightPerHour
    totals.netPerHour += pnl.netPerHour
    if (pnl.unpricedExportTypeIds.length > 0 || pnl.unpricedInputTypeIds.length > 0) {
      totals.coloniesWithUnpriced += 1
    }
  }
  return totals
}
