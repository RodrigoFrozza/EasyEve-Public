import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n/client'
import { SalesView } from './SalesView'

/**
 * A aba Vendas. O que estes travam é a regra 3 do projeto: falha nunca pode ser
 * invisível. Busca que falhou não pode parecer "nenhum item parado".
 */

const STERILE = 2875

const renderView = (props: Partial<Parameters<typeof SalesView>[0]> = {}) =>
  render(
    <I18nProvider>
      <SalesView hasContainersConfigured {...props} />
    </I18nProvider>
  )

describe('SalesView', () => {
  it('mostra o erro da busca em vez de uma aba em branco', async () => {
    renderView({ error: 'Failed to load sales backlog' })
    expect(await screen.findByText('Failed to load sales backlog')).toBeInTheDocument()
    expect(screen.queryByText(/No sale item sitting idle/i)).not.toBeInTheDocument()
  })

  it('backlog vazio de verdade diz que está vazio', async () => {
    renderView({ items: [] })
    expect(await screen.findByText(/No sale item sitting idle/i)).toBeInTheDocument()
  })

  it('número parcial é anunciado como parcial', async () => {
    renderView({
      items: [{ typeId: STERILE, name: 'Sterile Conduits', containerQty: 40, contractQty: 10, totalQty: 50 }],
      incomplete: true,
    })
    expect(await screen.findByText(/PARTIAL/)).toBeInTheDocument()
    expect(screen.getByText('Sterile Conduits')).toBeInTheDocument()
  })
})
