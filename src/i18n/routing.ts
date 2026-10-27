import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'pt-BR', 'zh', 'ja', 'ko'],
  defaultLocale: 'en'
})