import { PUBLIC_APP_URL } from '@/constants/external-links'

const jsonLdBase = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'EasyEve',
  description:
    'EVE Online analytics and mining tracker with real-time fleet tracking, loot analysis, combat logs, ship fitting, and market tools.',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web',
  author: {
    '@type': 'Organization',
    name: 'EasyEve',
  },
} as const

export function HomeJsonLd() {
  const jsonLd = {
    ...jsonLdBase,
    url: PUBLIC_APP_URL,
    author: {
      ...jsonLdBase.author,
      url: PUBLIC_APP_URL,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
