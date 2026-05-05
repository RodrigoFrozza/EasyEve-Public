import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PromoBannerSpotlight } from './PromoBannerSpotlight'

const pushMock = jest.fn()
const toastSuccessMock = jest.fn()
const toastErrorMock = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
  }: {
    children: ReactNode
    href: string
  }) {
    return <a href={href}>{children}</a>
  }
})

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

describe('PromoBannerSpotlight', () => {
  beforeEach(() => {
    pushMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'PROMO777',
        redeemPath: '/dashboard/subscription?promoCode=PROMO777',
        alreadyGenerated: false,
      }),
    }) as jest.Mock
  })

  it('redirects the user to the redeem page after generating a code', async () => {
    render(
      <PromoBannerSpotlight
        initialBanners={[
          {
            id: 'banner-1',
            title: 'Welcome reward',
            description: 'Generate your code',
            badgeText: 'Starter',
            buttonText: 'Generate code',
            dismissible: true,
            priority: 100,
            targetSegment: 'NEW_NON_PREMIUM_USERS',
            maxAccountAgeDays: 7,
            startsAt: null,
            endsAt: null,
            status: 'available',
            code: null,
            redeemPath: null,
          },
        ]}
      />
    )

    const button = screen.getByRole('button', { name: /generate code/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/dashboard/subscription?promoCode=PROMO777')
    })
  })
})
