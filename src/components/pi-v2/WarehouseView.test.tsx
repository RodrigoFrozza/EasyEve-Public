import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n/client'
import { WarehouseView } from './WarehouseView'
import type { WarehouseView as WarehouseData } from '@/lib/pi-v2/warehouse'

/**
 * A aba Armazém.
 *
 * A tela do PI v2 não monta local (o banco vive no Docker do Coolify), então teste
 * de render é a única verificação de UI disponível. O que estes travam é o que a
 * tela é OBRIGADA a dizer nesta entrega: que ela **ainda não desconta** nada, e que
 * container vazio não é a mesma coisa que container não encontrado.
 */

const WATER = 3645
const STERILE = 2875

const data = (over: Partial<WarehouseData> = {}): WarehouseData => ({
  stock: { [WATER]: 48_240 },
  containers: [
    {
      itemId: 1000,
      name: 'PI Box',
      characterId: 90_001,
      state: 'ok',
      piTypeCount: 3,
      otherTypeCount: 1,
      anomalies: 0,
    },
  ],
  items: [
    {
      typeId: WATER,
      name: 'Water',
      tier: 1,
      quantity: 48_240,
      consumptionPerHour: 837,
      autonomyHrs: 48_240 / 837,
      state: 'ok',
    },
  ],
  incomplete: false,
  fetchedAt: new Date().toISOString(),
  ...over,
})

const renderView = (props: Partial<Parameters<typeof WarehouseView>[0]> = {}) =>
  render(
    <I18nProvider>
      <WarehouseView
        data={data()}
        containers={[{ itemId: 1000, characterId: 90_001, name: 'PI Box' }]}
        baseHub={{ id: '60003760', name: 'UALX-3' }}
        onContainersChange={jest.fn()}
        {...props}
      />
    </I18nProvider>
  )

describe('o aviso desta entrega', () => {
  it('diz que a lista de compra AINDA não desconta este estoque', async () => {
    // Sem isto a tela pareceria já ter mudado a lista, e ele confiaria numa
    // quantidade que não mudou.
    renderView()
    expect(await screen.findByText(/still does NOT discount/i)).toBeInTheDocument()
  })
})

describe('estoque e autonomia', () => {
  it('mostra o item, a quantidade e quanto dura', async () => {
    renderView()
    expect(await screen.findByText('Water')).toBeInTheDocument()
    expect(screen.getByText(/48,240|48\.240/)).toBeInTheDocument()
    expect(screen.getByText(/≈2\.4d/)).toBeInTheDocument()
  })

  it('acabando e faltando ganham rótulo', () => {
    renderView({
      data: data({
        items: [
          {
            typeId: WATER,
            name: 'Water',
            tier: 1,
            quantity: 1000,
            consumptionPerHour: 100,
            autonomyHrs: 10,
            state: 'running_low',
          },
          {
            typeId: STERILE,
            name: 'Sterile Conduits',
            tier: 4,
            quantity: 0,
            consumptionPerHour: 5,
            autonomyHrs: 0,
            state: 'missing',
          },
        ],
      }),
    })
    expect(screen.getByText('running out')).toBeInTheDocument()
    expect(screen.getByText('missing')).toBeInTheDocument()
  })

  it('sem consumo diz "não é consumido", não "dura para sempre"', () => {
    renderView({
      data: data({
        items: [
          {
            typeId: STERILE,
            name: 'Sterile Conduits',
            tier: 4,
            quantity: 500,
            consumptionPerHour: 0,
            autonomyHrs: null,
            state: 'not_consumed',
          },
        ],
      }),
    })
    expect(screen.getByText('not consumed')).toBeInTheDocument()
  })
})

describe('zero ≠ não sei, na tela', () => {
  it('container vazio é estado próprio', () => {
    renderView({
      data: data({
        containers: [
          {
            itemId: 1000,
            name: 'PI Box',
            characterId: 90_001,
            state: 'empty',
            piTypeCount: 0,
            otherTypeCount: 0,
            anomalies: 0,
          },
        ],
      }),
    })
    expect(screen.getByText('empty')).toBeInTheDocument()
  })

  it('não encontrado diz o que fazer, e marca o estoque como parcial', () => {
    renderView({
      data: data({
        containers: [
          {
            itemId: 1000,
            name: 'PI Box',
            characterId: 90_001,
            state: 'not_found',
            piTypeCount: 0,
            otherTypeCount: 0,
            anomalies: 0,
          },
        ],
        incomplete: true,
      }),
    })
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
    // E explica a direção do erro: pede DEMAIS, nunca de menos.
    expect(screen.getByText(/ask for MORE than needed, never less/i)).toBeInTheDocument()
  })

  it('personagem sem o scope aparece como ação, não como falha genérica', () => {
    renderView({
      data: data({
        containers: [
          {
            itemId: 1000,
            name: 'PI Box',
            characterId: 90_001,
            state: 'no_scope',
            piTypeCount: 0,
            otherTypeCount: 0,
            anomalies: 0,
          },
        ],
        incomplete: true,
      }),
    })
    expect(screen.getByText(/re-link this character/i)).toBeInTheDocument()
  })

  it('localização inconsistente é reportada em vez de ignorada', () => {
    renderView({
      data: data({
        containers: [
          {
            itemId: 1000,
            name: 'PI Box',
            characterId: 90_001,
            state: 'ok',
            piTypeCount: 1,
            otherTypeCount: 0,
            anomalies: 2,
          },
        ],
      }),
    })
    expect(screen.getByText(/inconsistent location/i)).toBeInTheDocument()
  })
})

describe('sem container escolhido', () => {
  it('convida a escolher em vez de mostrar uma tabela vazia', async () => {
    renderView({ containers: [], data: undefined })
    expect(await screen.findByText(/No warehouse container picked yet/i)).toBeInTheDocument()
  })
})
