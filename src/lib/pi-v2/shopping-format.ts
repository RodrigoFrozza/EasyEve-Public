/**
 * Saídas da lista de compra — multibuy e CSV.
 *
 * ⚠️ **Client-safe por contrato: só tipos entram aqui.** Estas funções são
 * chamadas pelo botão de copiar/exportar, ou seja, rodam no navegador. Se
 * importassem `shopping.ts` (que alcança `market-prices` → `prisma`), o Prisma
 * inteiro entraria no bundle do cliente. Foi exatamente assim que a Etapa 2
 * quase vazou o Prisma pelo `sde.ts` — o `tsc` não pega, só o tamanho do bundle
 * denuncia.
 */

import type { ShoppingLine } from '@/lib/pi-v2/shopping-types'

/** Períodos que a tela oferece. Derivados da operação, não de gosto. */
export const SHOPPING_PERIODS_HRS = [24, 48, 72, 168] as const

/**
 * Formato do multibuy do EVE: `Nome<TAB>Quantidade`, uma linha por item. Cola
 * direto na janela do jogo — é o que transforma a análise em compra.
 *
 * Aceita qualquer coisa com nome e quantidade (linha de compra, item de entrega):
 * o formato é do JOGO, não da lista de compra, e duplicá-lo por tela seria criar
 * duas versões de uma coisa que só tem uma forma certa.
 */
export function toMultibuy(lines: Array<{ name: string; quantity: number }>): string {
  // Linha coberta pelo estoque tem quantidade 0 e não pode ir para o multibuy —
  // o jogo não compra zero, e a linha só polui a janela.
  return lines
    .filter((l) => l.quantity > 0)
    .map((l) => `${l.name}\t${l.quantity}`)
    .join('\n')
}

const CSV_HEADER = [
  'item',
  'tier',
  'consumo_bruto',
  'em_estoque_armazem',
  'quantidade',
  'hub',
  'preco_unitario',
  'frete_unitario',
  'efetivo_unitario',
  'custo_total',
  'volume_m3',
  'cobre_quantidade',
] as const

function csvCell(value: string | number | undefined): string {
  if (value == null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * CSV com a decomposição inteira. O jogador avançado quer o dado cru para
 * conferir na planilha dele — e conferir é exatamente como este modelo foi
 * validado.
 */
export function toCsv(lines: ShoppingLine[]): string {
  const rows = lines.map((l) =>
    [
      l.name,
      l.tier ?? '',
      l.grossQuantity,
      l.warehouseQuantity,
      l.quantity,
      l.chosen?.label ?? l.chosen?.origin ?? '',
      l.chosen ? round2(l.chosen.unitPrice) : '',
      l.chosen ? round2(l.chosen.freightPerUnit) : '',
      l.chosen ? round2(l.chosen.effectiveUnitPrice) : '',
      round2(l.totalCost),
      round2(l.totalVolumeM3),
      l.chosen ? (l.chosen.coversDemand ? 'sim' : 'nao') : '',
    ]
      .map(csvCell)
      .join(',')
  )
  return [CSV_HEADER.join(','), ...rows].join('\n')
}
