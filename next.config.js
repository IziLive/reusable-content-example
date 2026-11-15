import { withPayload } from '@payloadcms/next/withPayload'

import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'payload.nonventra.space',
        pathname: '/api/media/**',
        // Внимание: не указывайте здесь search, иначе параметры запроса будут запрещены
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins:
        process.env.NODE_ENV === 'development'
          ? ['localhost:3000']
          : [],
    },
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/*': ['./node_modules/.pnpm/strtok3@10.8.0/node_modules/strtok3/lib/**/*'],
  },
  redirects,
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
