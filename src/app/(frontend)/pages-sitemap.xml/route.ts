import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getServerSideURL } from '@/utilities/getURL'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 100

function escapeXML(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&apos;'
      default:
        return character
    }
  })
}

export async function GET(): Promise<Response> {
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined

  try {
    const siteURL = new URL(getServerSideURL())
    const hostname = siteURL.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')

    if (
      !['http:', 'https:'].includes(siteURL.protocol) ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '::1'
    ) {
      throw new Error('Invalid sitemap origin')
    }

    const origin = siteURL.origin
    payload = await getPayload({ config: configPromise })

    const urls = new Set<string>()
    urls.add(new URL('/', `${origin}/`).toString())
    let page = 1
    let maxPages: number | undefined

    while (true) {
      const result = await payload.find({
        collection: 'pages',
        depth: 0,
        draft: false,
        limit: PAGE_SIZE,
        overrideAccess: false,
        page,
        pagination: true,
        select: {
          slug: true,
        },
        where: {
          _status: {
            equals: 'published',
          },
        },
      })

      if (
        !Array.isArray(result.docs) ||
        typeof result.hasNextPage !== 'boolean' ||
        !Number.isSafeInteger(result.page) ||
        result.page !== page ||
        !Number.isSafeInteger(result.totalPages) ||
        result.totalPages < 1
      ) {
        throw new Error('Invalid Pages pagination response')
      }

      maxPages ??= result.totalPages

      for (const doc of result.docs) {
        if (typeof doc.slug !== 'string' || doc.slug.trim().length === 0) {
          continue
        }

        const path = doc.slug === 'home' ? '/' : `/${encodeURIComponent(doc.slug)}`
        urls.add(new URL(path, `${origin}/`).toString())
      }

      if (!result.hasNextPage) {
        break
      }

      if (result.docs.length === 0 || page >= maxPages || page >= Number.MAX_SAFE_INTEGER) {
        throw new Error('Pages pagination did not advance')
      }

      page += 1
    }

    const entries = [...urls].map((url) => `<url><loc>${escapeXML(url)}</loc></url>`)
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries,
      '</urlset>',
    ].join('')

    return new Response(xml, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/xml; charset=utf-8',
      },
    })
  } catch {
    const message = 'Failed to generate Pages sitemap'
    if (payload) {
      payload.logger.error(message)
    } else {
      console.error(message)
    }

    return new Response('Sitemap temporarily unavailable', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }
}
