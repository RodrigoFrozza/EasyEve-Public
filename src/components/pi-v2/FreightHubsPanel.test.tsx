import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n/client'
import { FreightHubsPanel } from './FreightHubsPanel'
import { JITA_HUB_ID, REGION_HUB_ID, type FreightHub } from '@/lib/pi-v2/pricing/freight-model'
import type { JfPlanInfo } from '@/lib/pi-v2/shopping-types'

/**
 * O painel de base + hubs.
 *
 * A tela nasceu longa demais: com quatro hubs abertos a config não cabia na janela.
 * O que estes testes travam é o resumo do card fechado — a única informação que
 * sobra quando o hub está colapsado, e portanto a que não pode faltar nem mentir.
 */

const RHEA = 28844

const jitaHub: FreightHub = {
  id: JITA_HUB_ID,
  name: 'Jita',
  inbound: { method: 'courier', transporter: 'ITL', perM3Rate: 850 },
}
const cj6: FreightHub = {
  id: '61000001',
  name: 'C-J6MT',
  inbound: { method: 'jf', jfTypeId: RHEA, isotopeQtyRoundTrip: 139_314, cargoM3: 340_000 },
}
const regionHub: FreightHub = { id: REGION_HUB_ID, name: 'Region' }

/** A conta do JF que o servidor devolve: 233 ISK/m³ na rota do Rodrigo. */
const jfPlan: JfPlanInfo = {
  hubKey: '61000001',
  hubName: 'C-J6MT',
  direction: 'inbound',
  jfTypeId: RHEA,
  jfName: 'Rhea',
  isotopeTypeId: 17888,
  isotopeName: 'Nitrogen Isotopes',
  isotopeQtyRoundTrip: 139_314,
  loadM3: 340_000,
  originPrice: 569,
  destinationPrice: 742,
  adviseAt: 'origin',
  refuelAt: 'origin',
  savingsPerTrip: (742 - 569) * 139_314,
  fuelCostPerTrip: 139_314 * 569,
  ratePerM3: (139_314 * 569) / 340_000,
  note: 'ok',
}

function renderPanel(hubs: FreightHub[], jfPlans: JfPlanInfo[] = []) {
  const onHubsChange = jest.fn()
  render(
    <I18nProvider>
      <FreightHubsPanel
        baseHub={{ id: '60003760', name: 'UALX-3' }}
        hubs={hubs}
        warnings={[]}
        jfPlans={jfPlans}
        onBaseChange={jest.fn()}
        onHubsChange={onHubsChange}
        onRememberContract={jest.fn()}
        onRecallContract={jest.fn()}
      />
    </I18nProvider>
  )
  return { onHubsChange }
}

/** Os botões de método só existem quando o card está ABERTO. */
const methodButtons = () =>
  screen.queryAllByRole('button').filter((b) => b.getAttribute('aria-pressed') != null)

describe('teste 3 — hub configurado nasce colapsado, com resumo', () => {
  it('o courier resume nome · método · ISK/m³', async () => {
    renderPanel([jitaHub])
    expect(await screen.findByText('Jita')).toBeInTheDocument()
    expect(screen.getByText('Courier')).toBeInTheDocument()
    expect(screen.getByText(/850.*ISK\/m³/)).toBeInTheDocument()
    // Colapsado: o formulário não está na tela.
    expect(methodButtons()).toHaveLength(0)
  })

  it('o JF resume com a taxa que o SERVIDOR calculou, não com uma chutada', () => {
    renderPanel([cj6], [jfPlan])
    expect(screen.getByText('C-J6MT')).toBeInTheDocument()
    expect(screen.getByText('Own JF')).toBeInTheDocument()
    // 139.314 × 569 ÷ 340.000 = 233,17 ISK/m³
    expect(screen.getByText(/233.*ISK\/m³/)).toBeInTheDocument()
  })

  it('sem a conta do servidor ainda, mostra o método sem inventar taxa', () => {
    renderPanel([cj6])
    expect(screen.getByText('Own JF')).toBeInTheDocument()
    expect(screen.queryByText(/ISK\/m³/)).not.toBeInTheDocument()
  })

  it('expande ao clicar no cabeçalho', () => {
    renderPanel([jitaHub])
    fireEvent.click(screen.getByText('Jita'))
    expect(methodButtons()).toHaveLength(2)
  })
})

describe('hub sem configurar chama a atenção', () => {
  it('nasce ABERTO, porque há trabalho a fazer', () => {
    renderPanel([{ id: '61000001', name: 'C-J6MT' }])
    expect(methodButtons()).toHaveLength(2)
  })

  it('Região é exceção: fica fechada mesmo vazia — a maioria não compra lá', () => {
    renderPanel([regionHub])
    expect(methodButtons()).toHaveLength(0)
    expect(screen.getByText(/freight not configured/i)).toBeInTheDocument()
  })
})

describe('Região e Jita são opcionais, e a tela diz isso', () => {
  it('as duas ganham o selo de opcional', async () => {
    renderPanel([regionHub, jitaHub])
    expect(await screen.findAllByText('optional')).toHaveLength(2)
  })

  it('a ajuda explica que deixar em branco está OK', () => {
    renderPanel([regionHub])
    fireEvent.click(screen.getByLabelText(/What "Region" means/i))
    expect(screen.getByText(/leave it blank if you do not buy here/i)).toBeInTheDocument()
  })

  it('fonte pública não tem botão de remover — ela existe sempre', () => {
    renderPanel([jitaHub])
    expect(screen.queryByLabelText(/Remove Jita/i)).not.toBeInTheDocument()
  })

  it('estrutura tem botão de remover', () => {
    const { onHubsChange } = renderPanel([cj6])
    fireEvent.click(screen.getByLabelText(/Remove C-J6MT/i))
    expect(onHubsChange).toHaveBeenCalledWith([])
  })
})

describe('quem vende num hub vê isso no resumo', () => {
  it('o selo aparece quando há saída configurada', () => {
    renderPanel([{ ...jitaHub, outbound: { method: 'courier', transporter: 'ITL', perM3Rate: 900 } }])
    expect(screen.getByText('sells here')).toBeInTheDocument()
  })

  it('sem saída, nenhum selo — o default é vender na base', () => {
    renderPanel([jitaHub])
    expect(screen.queryByText('sells here')).not.toBeInTheDocument()
  })
})
