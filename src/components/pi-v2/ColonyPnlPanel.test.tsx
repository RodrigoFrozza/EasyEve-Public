import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n/client'
import { ColonyPnlPanel } from './ColonyPnlPanel'
import { PortfolioNetSummary } from './PortfolioNetSummary'
import { computeColonyPnl, sumPnl, type ColonyPnl } from '@/lib/pi-v2/pnl'
import { getCommodityVolume } from '@/lib/pi-v2/sde'
import type { CommodityBalance } from '@/lib/pi-v2/demand'

/**
 * O P&L na tela.
 *
 * Estes testes existem porque a tela do PI v2 só monta em produção (não há infra
 * local: o banco vive no Docker do Coolify). O que eles travam é o que a tela é
 * OBRIGADA a dizer: que o número é incompleto quando falta preço, e que o frete de
 * saída só aparece quando existe.
 */

const STERILE_CONDUITS = 2875 // P4
const WATER = 3645 // P1

function balance(over: Partial<CommodityBalance> & { typeId: number }): CommodityBalance {
  return {
    name: over.typeId === STERILE_CONDUITS ? 'Sterile Conduits' : 'Water',
    demandPerHour: 0,
    extractionPerHour: 0,
    productionPerHour: 0,
    localSupplyPerHour: 0,
    importNeededPerHour: 0,
    surplusPerHour: 0,
    exportedPerHour: 0,
    wastedPerHour: 0,
    isImported: false,
    isExportable: false,
    ...over,
  }
}

function pnl(over: Partial<Parameters<typeof computeColonyPnl>[0]> = {}): ColonyPnl {
  return computeColonyPnl({
    balances: [
      balance({ typeId: STERILE_CONDUITS, exportedPerHour: 10, isExportable: true }),
      balance({ typeId: WATER, importNeededPerHour: 100, isImported: true }),
    ],
    sellUnitPrice: () => 1_500_000,
    inputCost: () => ({ effectiveUnitPrice: 600, hubKey: '1', hubLabel: 'UALX-3' }),
    volumePerUnit: getCommodityVolume,
    exportTaxRate: 0.02,
    importTaxRate: 0.02,
    outboundRatePerM3: 0,
    ...over,
  })
}

const renderPanel = (props: Partial<Parameters<typeof ColonyPnlPanel>[0]> = {}) =>
  render(
    <I18nProvider>
      <ColonyPnlPanel pnl={pnl()} sellsAtBase {...props} />
    </I18nProvider>
  )

describe('a decomposição aparece, não só o total', () => {
  it('mostra os cinco termos da conta e o NET', async () => {
    renderPanel()
    expect(await screen.findByText('Export revenue')).toBeInTheDocument()
    expect(screen.getByText('Export tax (POCO)')).toBeInTheDocument()
    // Texto exato: "input cost" também aparece no rodapé que explica a conta.
    expect(screen.getByText('Input cost (with freight)')).toBeInTheDocument()
    expect(screen.getByText('Import tax (POCO)')).toBeInTheDocument()
    expect(screen.getByText('NET')).toBeInTheDocument()
  })

  it('lista o que foi vendido e o que foi comprado, com o hub da compra', () => {
    renderPanel()
    expect(screen.getByText('Sterile Conduits')).toBeInTheDocument()
    expect(screen.getByText('Water')).toBeInTheDocument()
    expect(screen.getByText('UALX-3')).toBeInTheDocument()
    // E diz que o hub é o mesmo da lista — a garantia número um, na tela.
    expect(screen.getByText(/same ones the shopping list uses/i)).toBeInTheDocument()
  })
})

describe('vender no lugar vs vender fora', () => {
  it('vendendo na base, não existe linha de frete de saída', () => {
    // Uma linha de 0 para quem vende na base é ruído, não informação.
    renderPanel()
    expect(screen.queryByText(/Outbound freight to/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Sold at your base/i)).toBeInTheDocument()
  })

  it('vendendo fora, a linha aparece com o nome do hub', () => {
    renderPanel({
      pnl: pnl({ outboundRatePerM3: 800 }),
      sellsAtBase: false,
      sellHubName: 'Jita',
    })
    expect(screen.getByText(/Outbound freight to Jita/i)).toBeInTheDocument()
    expect(screen.getByText(/Sold at Jita/i)).toBeInTheDocument()
  })
})

describe('o que a tela é obrigada a avisar', () => {
  it('item sem preço de venda deixa o NET incompleto, e isso é dito', () => {
    renderPanel({ pnl: pnl({ sellUnitPrice: () => 0 }) })
    expect(screen.getByText(/Incomplete/i)).toBeInTheDocument()
  })

  it('insumo sem preço também marca incompleto — o NET estaria inflado', () => {
    renderPanel({ pnl: pnl({ inputCost: () => null }) })
    expect(screen.getByText(/Incomplete/i)).toBeInTheDocument()
  })

  it('com tudo precificado, nenhum aviso aparece', () => {
    renderPanel()
    expect(screen.queryByText(/Incomplete/i)).not.toBeInTheDocument()
  })

  it('rodar abaixo do desenho mostra quanto custa não visitar', () => {
    const current = pnl({
      balances: [balance({ typeId: STERILE_CONDUITS, exportedPerHour: 5, isExportable: true })],
    })
    const designed = pnl({
      balances: [balance({ typeId: STERILE_CONDUITS, exportedPerHour: 10, isExportable: true })],
    })
    renderPanel({ pnl: current, designed })
    expect(screen.getByText(/Running below design/i)).toBeInTheDocument()
  })
})

describe('NET agregado do portfólio', () => {
  const renderTotals = (props: Partial<Parameters<typeof PortfolioNetSummary>[0]> = {}) =>
    render(
      <I18nProvider>
        <PortfolioNetSummary totals={sumPnl([pnl(), pnl()])} {...props} />
      </I18nProvider>
    )

  it('mostra hora, dia e mês, e quantas colônias somou', async () => {
    renderTotals()
    expect(await screen.findByText(/Portfolio net/i)).toBeInTheDocument()
    expect(screen.getByText(/\/day/)).toBeInTheDocument()
    expect(screen.getByText(/\/month/)).toBeInTheDocument()
    expect(screen.getByText(/2 colonies/i)).toBeInTheDocument()
  })

  it('diz que dia e mês são projeção da taxa por hora, não medição', () => {
    renderTotals()
    expect(screen.getByText(/projected out, not measured/i)).toBeInTheDocument()
  })

  it('herda a incerteza: colônia com item sem preço torna o total incompleto', () => {
    renderTotals({ totals: sumPnl([pnl(), pnl({ sellUnitPrice: () => 0 })]) })
    expect(screen.getByText(/this total is incomplete/i)).toBeInTheDocument()
  })

  it('sem dado ainda, não mostra 0 — mostra que está calculando', () => {
    // Um NET de 0 ISK/h enquanto o mercado carrega seria um número falso na tela.
    renderTotals({ totals: undefined, loading: true })
    expect(screen.getByText(/Working out the portfolio net/i)).toBeInTheDocument()
    expect(screen.queryByText(/\/h$/)).not.toBeInTheDocument()
  })

  it('falha de mercado é dita, não escondida atrás de um zero', () => {
    renderTotals({ totals: undefined, error: 'boom' })
    expect(screen.getByText(/Portfolio net unavailable/i)).toBeInTheDocument()
  })
})
