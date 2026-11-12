const configuredSiteURL = process.env.NEXT_PUBLIC_SERVER_URL
const vercelProductionURL = process.env.VERCEL_PROJECT_PRODUCTION_URL

if (configuredSiteURL === undefined && vercelProductionURL === undefined) {
  throw new Error('Set NEXT_PUBLIC_SERVER_URL or VERCEL_PROJECT_PRODUCTION_URL to generate sitemaps')
}

const siteURLFromVercel = configuredSiteURL === undefined
const rawSiteURL = siteURLFromVercel
  ? /^[a-z][a-z\d+.-]*:\/\//i.test(vercelProductionURL)
    ? vercelProductionURL
    : `https://${vercelProductionURL}`
  : configuredSiteURL

let parsedSiteURL

try {
  parsedSiteURL = new URL(rawSiteURL)
} catch {
  throw new Error('The configured site URL must be an absolute HTTP(S) URL with a valid hostname')
}

const hostname = parsedSiteURL.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
const isForbiddenHostname =
  hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  hostname === 'example.com' ||
  hostname.endsWith('.example.com')

if (
  !['http:', 'https:'].includes(parsedSiteURL.protocol) ||
  !hostname ||
  isForbiddenHostname ||
  parsedSiteURL.pathname !== '/' ||
  parsedSiteURL.search !== '' ||
  parsedSiteURL.hash !== '' ||
  parsedSiteURL.username !== '' ||
  parsedSiteURL.password !== '' ||
  (siteURLFromVercel && parsedSiteURL.protocol !== 'https:')
) {
  throw new Error('The configured site URL must be a public HTTP(S) origin without credentials, path, query, or hash')
}

const SITE_URL = parsedSiteURL.toString().replace(/\/$/, '')

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  exclude: [
    '/pages-sitemap.xml',
    '/search',
    '/admin',
    '/admin/*',
    '/api',
    '/api/*',
    '/next/preview',
    '/next/exit-preview',
    '/next/seed',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        disallow: '/admin/*',
      },
    ],
    additionalSitemaps: [`${SITE_URL}/pages-sitemap.xml`],
  },
}
