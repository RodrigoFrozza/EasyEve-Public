import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '@/i18n/client'
import { DeliveryView } from './DeliveryView'
import type { DemandBreakdown, ShoppingLine } from '@/lib/pi-v2/shopping-types'

/**
 * A aba Entrega.
 *
 * A tela do PI v2 não monta local (o banco vive no Docker do Coolify), então teste
 * de render é a única verificação de UI disponível. O que estes travam é o que a
 * tela é OBRIGADA a fazer: separar por personagem, poder descer até o planeta, e
 * copiar **daquele bloco** — copiar a lista toda de um botão de bloco mandaria o
 * jogador levar material de outro personagem.
 */

const WATER = 2389
const BIOCELLS = 2390

const at = (
  characterId: number,
  characterName: string,
  planetId: number,
  planetName: string,
  quantity: number
): DemandBreakdown => ({
  characterId,
  characterName,
  planetId,
  planetName,
  quantity,
  onHandQuantity: 0,
})

const line = (
  typeId: number,
  name: string,
  breakdown: DemandBreakdown[],
  volumePerUnit = 0.38
): ShoppingLine => ({
  typeId,
  name,
  tier: 0,
  quantity: 0,
  grossQuantity: 0,
  onHandQuantity: 0,
  coveredByStock: false,
  volumePerUnit,
  totalVolumeM3: 0,
  chosen: null,
  quotes: [],
  totalCost: 0,
  short: false,
  breakdown,
})

const lines: ShoppingLine[] = [
  line(WATER, 'Water', [
    at(1, 'Zeca Setaum', 11, 'Barren I', 1000),
    at(1, 'Zeca Setaum', 12, 'Storm II', 500),
    at(2, 'Alt Dois', 21, 'Gas III', 200),
  ]),
  line(BIOCELLS, 'Biocells', [at(1, 'Zeca Setaum', 11, 'Barren I', 40)], 1.5),
]

const renderView = (props: Partial<Parameters<typeof DeliveryView>[0]> = {}) =>
  render(
    <I18nProvider>
      <DeliveryView lines={lines} periodHours={24} {...props} />
    </I18nProvider>
  )

describe('agrupamento na tela', () => {
  it('um bloco por personagem, com o material somado dos planetas dele', async () => {
    renderView()
    expect(await screen.findByText('Zeca Setaum')).toBeInTheDocument()
    expect(screen.getByText('Alt Dois')).toBeInTheDocument()
    // Tudo começa recolhido: a tabela só aparece depois de abrir o bloco.
    expect(screen.queryByText('1,500')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Zeca Setaum/i }))
    // 1.000 + 500 numa ida só.
    expect(await screen.findByText('1,500')).toBeInTheDocument()
  })

  it('os planetas só aparecem quando ele pede para detalhar', async () => {
    renderView()
    expect(screen.queryByText('Barren I')).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /break down by planet/i }))
    expect(await screen.findByText('Barren I')).toBeInTheDocument()
    expect(screen.getByText('Storm II')).toBeInTheDocument()
  })
})

describe('cópia por bloco', () => {
  it('copia só o material daquele personagem — não a lista inteira', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    renderView()
    const [firstCopy] = await screen.findAllByRole('button', { name: /^copy$/i })
    await userEvent.click(firstCopy)

    // A ordem alfabética põe Alt Dois primeiro: 200 Water, e nada do Zeca.
    expect(writeText).toHaveBeenCalledWith('Water\t200')
  })
})

describe('usabilidade: recolhido por padrão, expandir/recolher tudo, marcar entregue', () => {
  it('expandir tudo abre todos os blocos, recolher tudo fecha todos', async () => {
    renderView()
    expect(screen.queryByText('1,500')).not.toBeInTheDocument()
    expect(screen.queryByText('200')).not.toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /expand all/i }))
    expect(await screen.findByText('1,500')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()

    // O mesmo botão vira "recolher tudo" quando tudo já está aberto.
    await userEvent.click(screen.getByRole('button', { name: /collapse all/i }))
    expect(screen.queryByText('1,500')).not.toBeInTheDocument()
    expect(screen.queryByText('200')).not.toBeInTheDocument()
  })

  it('o resumo do topo mostra quantos destinos, itens distintos e volume — sem abrir nada', async () => {
    renderView()
    expect(await screen.findByText('2 character(s)')).toBeInTheDocument()
    expect(screen.getByText('2 distinct items')).toBeInTheDocument()
  })

  it('marcar como entregue conta no resumo e pode ser desfeito', async () => {
    renderView()
    const [firstMark] = await screen.findAllByRole('button', { name: /mark as delivered/i })
    await userEvent.click(firstMark)
    expect(await screen.findByText('1 of 2 delivered')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /unmark delivery/i }))
    expect(screen.queryByText(/delivered$/)).not.toBeInTheDocument()
  })
})

describe('o aviso que a tela é obrigada a dar', () => {
  it('diz que a quantidade é BRUTA, e por que não bate com a lista de compra', async () => {
    renderView()
    expect(await screen.findByText(/gross consumption for the period/i)).toBeInTheDocument()
  })

  it('sem nada a entregar, diz isso em vez de mostrar uma tela vazia', async () => {
    renderView({ lines: [] })
    expect(await screen.findByText(/nothing to deliver/i)).toBeInTheDocument()
  })
})
