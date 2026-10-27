import { fireEvent, render, screen } from '@testing-library/react'
import { Combobox } from './combobox'

const options = [
  { value: 'Sanctum', label: 'Sanctum' },
  { value: 'Haven', label: 'Haven' },
]

describe('Combobox allowFreeText', () => {
  it('does not offer a free-text option when allowFreeText is not set', () => {
    render(<Combobox options={options} value={null} onChange={jest.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'Unknown Anomaly' },
    })

    expect(screen.queryByText('Use "Unknown Anomaly"')).not.toBeInTheDocument()
  })

  it('offers a free-text option when the typed value matches no existing option', () => {
    const onChange = jest.fn()
    render(<Combobox options={options} value={null} onChange={onChange} allowFreeText />)

    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'Unknown Anomaly' },
    })

    const freeTextOption = screen.getByText('Use "Unknown Anomaly"')
    fireEvent.click(freeTextOption)

    expect(onChange).toHaveBeenCalledWith('Unknown Anomaly')
  })

  it('does not offer a free-text option when the typed value matches an existing option', () => {
    render(<Combobox options={options} value={null} onChange={jest.fn()} allowFreeText />)

    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'Sanctum' },
    })

    expect(screen.queryByText('Use "Sanctum"')).not.toBeInTheDocument()
    expect(screen.getByText('Sanctum')).toBeInTheDocument()
  })

  it('shows a previously committed free-text value as the trigger label, not the placeholder', () => {
    render(
      <Combobox
        options={options}
        value="A Custom Anomaly Name"
        onChange={jest.fn()}
        placeholder="Select an anomaly"
        allowFreeText
      />
    )

    expect(screen.getByText('A Custom Anomaly Name')).toBeInTheDocument()
    expect(screen.queryByText('Select an anomaly')).not.toBeInTheDocument()
  })
})
