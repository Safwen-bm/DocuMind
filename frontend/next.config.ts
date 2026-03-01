import { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // frontend runs on 3001 so it doesn't conflict with backend on 3000
}

export default withNextIntl(nextConfig)