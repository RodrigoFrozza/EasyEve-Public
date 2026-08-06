import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n/client'
import { HubFreightForm } from './HubFreightForm'
import { getJumpFreighter } from '@/lib/pi-v2/jf-data'
import type { FreightHub } from '@/lib/pi-v2/pricing/freight-model'
import type { JfPlanInfo } from '@/lib/pi-v2/shopping-types'

/**
 * O formulário da perna de entrada.
 *
 * Estes testes existem porque a tela do PI v2 só monta em produção (não há infra
 * local: o banco fica dentro do Docker do Coolify). Sem eles, um erro de render no
 * modo JF só apareceria no ar, na frente do usuário.
 *
 * O que travam é o vocabulário do modelo: **zero e "não sei" não podem parecer a
 * mesma coisa na tela.**
 */

const RHEA = 28844

function renderForm(hub: FreightHub, plan?: JfPlanInfo) {
  const onChange = jest.fn()
  render(
    <I18nProvider>
      <HubFreightForm
        hub={hub}
        plans={plan ? [plan] : undefined}
        onChange={onChange}
        onRememberContract={jest.fn()}
        onRecallContract={jest.fn()}
      />
    </I18nProvider>
  )
  return { onChange }
}

/** Os botões de método: os únicos com aria-pressed (o toggle da saída não tem). */
const methodButtons = () =>
  screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') != null)

const hub = (inbound?: FreightHub['inbound']): FreightHub => ({
  id: '61000001',
  name: 'C-J6MT',
  inbound,
})

const jfPlan = (over: Partial<JfPlanInfo> = {}): JfPlanInfo => ({
  hubKey: '61000001',
  hubName: 'C-J6MT',
  direction: 'inbound',
  jfTypeId: RHEA,
  jfName: 'Rhea',
  isotopeTypeId: 17888,
  isotopeName: 'Nitrogen Isotopes',
  isotopeQtyRoundTrip: 12_000,
  loadM3: 144_000,
  originPrice: 590,
  destinationPrice: 742,
  adviseAt: 'origin',
  refuelAt: 'origin',
  savingsPerTrip: (742 - 590) * 12_000,
  fuelCostPerTrip: 12_000 * 590,
  ratePerM3: (12_000 * 590) / 144_000,
  note: 'ok',
  ...over,
})

describe('perna não configurada', () => {
  it('diz que não está configurada em vez de mostrar 0', async () => {
    renderForm(hub(undefined))
    // `find*`: o dicionário do i18n carrega de forma assíncrona, e no primeiro
    // render da suíte ainda não chegou.
    expect(await screen.findByText(/freight not configured/i)).toBeInTheDocument()
    // Nenhum dos métodos aparece selecionado: ele ainda não escolheu.
    const pressed = methodButtons().map((b) => b.getAttribute('aria-pressed'))
    expect(pressed).toEqual(['false', 'false'])
  })

  it('não oferece "local" — um hub nunca é a base', () => {
    // Oferecer o botão seria oferecer frete 0 com a justificativa errada, e o
    // texto ("você já está nesta estação") seria falso para um hub distante.
    renderForm(hub(undefined))
    expect(methodButtons()).toHaveLength(2)
    expect(screen.queryByText(/Local base/i)).not.toBeInTheDocument()
  })

  it('escolher JF já nasce com um casco e o cargo dele, do SDE', () => {
    const { onChange } = renderForm(hub(undefined))
    fireEvent.click(screen.getByText('Own JF'))
    const next = onChange.mock.calls[0]![0] as FreightHub
    expect(next.inbound!.method).toBe('jf')
    const jf = getJumpFreighter((next.inbound as { jfTypeId: number }).jfTypeId)!
    expect((next.inbound as { cargoM3: number }).cargoM3).toBe(jf.cargoM3)
  })
})

describe('modo JF', () => {
  const jfHub = hub({
    method: 'jf',
    jfTypeId: RHEA,
    isotopeQtyRoundTrip: 12_000,
    cargoM3: 144_000,
  })

  it('lista os quatro cascos com cargo e isótopo — o jogador confere de onde vem', () => {
    renderForm(jfHub)
    expect(screen.getByRole('option', { name: /Rhea .* Nitrogen Isotopes/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Ark .* Helium Isotopes/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Anshar .* Oxygen Isotopes/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Nomad .* Hydrogen Isotopes/ })).toBeInTheDocument()
  })

  it('mostra a conta do servidor e recomenda onde abastecer', () => {
    renderForm(jfHub, jfPlan())
    expect(screen.getByText(/Refuel at the origin/i)).toBeInTheDocument()
    expect(screen.getByText(/fuel per round trip/i)).toBeInTheDocument()
    expect(screen.getByText(/ISK\/m³/)).toBeInTheDocument()
  })

  it('sem book do isótopo, avisa em vez de mostrar frete zero', () => {
    renderForm(
      jfHub,
      jfPlan({
        originPrice: null,
        destinationPrice: null,
        fuelCostPerTrip: null,
        ratePerM3: null,
        savingsPerTrip: 0,
        note: 'no_isotope_price',
      })
    )
    expect(screen.getByText(/fuel cost unknown/i)).toBeInTheDocument()
  })

  it('sem a quantidade do DOTLAN, pede o número em vez de calcular', () => {
    renderForm(hub({ method: 'jf', jfTypeId: RHEA, isotopeQtyRoundTrip: 0, cargoM3: 144_000 }))
    expect(screen.getByText(/does not do jump planning/i)).toBeInTheDocument()
  })

  it('escolher o lado mais caro na mão é respeitado, mas fica avisado', () => {
    renderForm(jfHub, jfPlan({ refuelAt: 'destination' }))
    expect(screen.getByText(/more expensive side/i)).toBeInTheDocument()
  })
})

describe('modo courier', () => {
  it('mostra a taxa marginal derivada dos termos', () => {
    renderForm(hub({ method: 'courier', transporter: 'ITL', perM3Rate: 800 }))
    expect(screen.getByText(/Effective per-item rate/i)).toBeInTheDocument()
    expect(screen.getByText(/800.*ISK\/m³/)).toBeInTheDocument()
  })

  it('só carga cheia, sem o m³ dela, não vira taxa inventada', () => {
    renderForm(
      hub({ method: 'courier', transporter: 'ITL', perM3Rate: null, fullLoadReward: 280_000_000 })
    )
    expect(screen.getByText(/cannot be attributed per item/i)).toBeInTheDocument()
  })

  it('campo em branco é "N/A", não zero', () => {
    renderForm(hub({ method: 'courier', transporter: 'ITL', perM3Rate: 800, minReward: null }))
    const minReward = screen.getByLabelText(/Minimum reward/i, { selector: 'input' })
    expect(minReward).toHaveValue('')
    expect(minReward).toHaveAttribute('placeholder', 'N/A')
  })
})

describe('teste 1 — separador de milhar nos campos numéricos', () => {
  /** Digita no campo e devolve o valor que a perna recebeu. */
  const type = (labelRe: RegExp, text: string, hubIn: FreightHub) => {
    // Cada formato é um render novo: sem limpar, os inputs dos anteriores ficam
    // no body e a busca por rótulo acha vários.
    cleanup()
    const { onChange } = renderForm(hubIn)
    fireEvent.change(screen.getByLabelText(labelRe, { selector: 'input' }), {
      target: { value: text },
    })
    return onChange.mock.calls.at(-1)![0] as FreightHub
  }

  const jfHub = hub({ method: 'jf', jfTypeId: RHEA, isotopeQtyRoundTrip: 0, cargoM3: 144_000 })

  it('os 139.314 isótopos do DOTLAN entram certos nos três formatos', () => {
    // O bug: `139,314` era lido como 139 e o ISK/m³ saía 1000× errado, calado.
    for (const text of ['139.314', '139,314', '139314']) {
      const next = type(/Isotopes/i, text, jfHub)
      expect((next.inbound as { isotopeQtyRoundTrip: number }).isotopeQtyRoundTrip).toBe(139_314)
    }
  })

  it('a carga real aceita 340.000 nos três formatos', () => {
    for (const text of ['340.000', '340,000', '340000']) {
      const next = type(/Real load/i, text, jfHub)
      expect((next.inbound as { cargoM3: number }).cargoM3).toBe(340_000)
    }
  })

  it('os campos do courier também: per m³ e teto', () => {
    const courierHub = hub({ method: 'courier', transporter: 'ITL', perM3Rate: null })
    for (const text of ['1.250', '1,250', '1250']) {
      const next = type(/ISK per m³/i, text, courierHub)
      expect((next.inbound as { perM3Rate: number }).perM3Rate).toBe(1250)
    }
    for (const text of ['280.000.000', '280,000,000', '280000000']) {
      const next = type(/Full load flat rate/i, text, courierHub)
      expect((next.inbound as { fullLoadReward: number }).fullLoadReward).toBe(280_000_000)
    }
  })

  it('o collateral continua decimal: 0,005 é meio por cento', () => {
    const courierHub = hub({ method: 'courier', transporter: 'ITL', perM3Rate: 800 })
    for (const text of ['0,005', '0.005']) {
      const next = type(/Collateral rate/i, text, courierHub)
      expect((next.inbound as { collateralRate: number }).collateralRate).toBe(0.005)
    }
  })

  it('texto que não é número não vira preço', () => {
    const next = type(/ISK per m³/i, 'abc', hub({ method: 'courier', transporter: 'ITL' }))
    expect((next.inbound as { perM3Rate: number | null }).perM3Rate).toBeNull()
  })
})

describe('teste 2 — a ajuda não é recortada pelo card', () => {
  it('o texto do popover vai para um portal fora do container', () => {
    // Era `absolute` dentro do card: o texto do Region ficava cortado pela borda.
    // Radix o move para um portal no fim do body, onde nenhum `overflow` de
    // ancestral alcança — é isso que este teste trava.
    const { container } = render(
      <I18nProvider>
        <div style={{ width: 240, overflow: 'hidden' }}>
          <HubFreightForm
            hub={hub({ method: 'courier', transporter: 'ITL', perM3Rate: 800 })}
            onChange={jest.fn()}
            onRememberContract={jest.fn()}
            onRecallContract={jest.fn()}
          />
        </div>
      </I18nProvider>
    )
    fireEvent.click(screen.getByLabelText(/Full load flat rate/i, { selector: 'button' }))

    const body = screen.getByText(/never pay more than this/i)
    expect(body).toBeInTheDocument()
    // A prova: o conteúdo NÃO está dentro da árvore do componente estreito.
    expect(container.contains(body)).toBe(false)
    expect(document.body.contains(body)).toBe(true)
  })
})

describe('direção de saída (base → hub)', () => {
  it('nasce colapsada e diz que ele não vende ali — o default é vender na base', () => {
    renderForm(hub({ method: 'courier', transporter: 'ITL', perM3Rate: 800 }))
    expect(screen.getByText(/not selling here/i)).toBeInTheDocument()
    // Colapsada: só o seletor da ENTRADA está na tela.
    expect(methodButtons()).toHaveLength(2)
  })

  it('abre com a saída já configurada, e os dois seletores convivem', () => {
    render(
      <I18nProvider>
        <HubFreightForm
          hub={{
            id: '61000001',
            name: 'C-J6MT',
            inbound: { method: 'courier', transporter: 'ITL', perM3Rate: 800 },
            outbound: { method: 'courier', transporter: 'GDSO', perM3Rate: 900 },
          }}
          onChange={jest.fn()}
          onRememberContract={jest.fn()}
          onRecallContract={jest.fn()}
        />
      </I18nProvider>
    )
    // Dois seletores de método: um por direção.
    expect(methodButtons()).toHaveLength(4)
    expect(screen.queryByText(/not selling here/i)).not.toBeInTheDocument()
  })

  it('expandir a saída explica que o preço de venda ainda não é por destino', () => {
    // Sem esse aviso, configurar a saída pareceria trazer o preço melhor de lá —
    // e ela só acrescenta o custo de chegar.
    renderForm(hub({ method: 'courier', transporter: 'ITL', perM3Rate: 800 }))
    fireEvent.click(screen.getByText(/Outbound/i))
    expect(screen.getByText(/only ADDS the cost of hauling there/i)).toBeInTheDocument()
    expect(methodButtons()).toHaveLength(4)
  })

  it('configurar a saída não mexe na entrada', () => {
    const { onChange } = renderForm(hub({ method: 'courier', transporter: 'ITL', perM3Rate: 800 }))
    fireEvent.click(screen.getByText(/Outbound/i))
    // O segundo bloco é o da saída: seus botões vêm depois dos da entrada.
    fireEvent.click(methodButtons()[3]!) // "Own JF" da saída
    const next = onChange.mock.calls[0]![0] as FreightHub
    expect(next.outbound!.method).toBe('jf')
    expect(next.inbound).toMatchObject({ method: 'courier', perM3Rate: 800 })
  })
})

describe('perna `local` gravada de antes', () => {
  it('é tratada como ausente: pede um método em vez de dizer que não há frete', () => {
    // A config de quem abriu a tela antes do fix. `local` num hub nunca foi válido.
    renderForm(hub({ method: 'local' }))
    expect(screen.queryByText(/already at this station/i)).not.toBeInTheDocument()
    expect(screen.getByText(/freight not configured/i)).toBeInTheDocument()
    const pressed = methodButtons().map((b) => b.getAttribute('aria-pressed'))
    expect(pressed).toEqual(['false', 'false'])
  })
})
