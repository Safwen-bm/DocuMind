import { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // Required for Docker — copies only necessary files into .next/standalone
  output: 'standalone',
}

export default withNextIntl(nextConfig)