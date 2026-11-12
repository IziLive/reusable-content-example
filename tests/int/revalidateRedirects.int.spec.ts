import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from 'payload'
import { plugins } from '@/plugins'
import {
  revalidateRedirects,
  revalidateRedirectsAfterDelete,
} from '@/hooks/revalidateRedirects'

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import { revalidateTag } from 'next/cache'

describe('Redirect cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(['create', 'update'] as const)(
    'invalidates the redirects cache after %s',
    (operation) => {
      const doc = { id: 'redirect-1', from: '/old', to: { url: '/new' } }
      const payload = { logger: { info: vi.fn() } }

      const result = revalidateRedirects({
        doc,
        operation,
        req: { payload },
      } as unknown as Parameters<typeof revalidateRedirects>[0])

      expect(result).toBe(doc)
      expect(revalidateTag).toHaveBeenCalledWith('redirects')
      expect(payload.logger.info).toHaveBeenCalledWith('Revalidating redirects')
    },
  )

  it('invalidates the redirects cache after a delete', () => {
    const doc = { id: 'redirect-1', from: '/old', to: { url: '/new' } }
    const payload = { logger: { info: vi.fn() } }

    const result = revalidateRedirectsAfterDelete({
      doc,
      req: { payload },
    } as unknown as Parameters<typeof revalidateRedirectsAfterDelete>[0])

    expect(result).toBe(doc)
    expect(revalidateTag).toHaveBeenCalledWith('redirects')
    expect(payload.logger.info).toHaveBeenCalledWith('Revalidating redirects')
  })

  it('registers both invalidation hooks on the Redirects collection', async () => {
    const redirectsPlugin = plugins[0]
    expect(redirectsPlugin).toBeDefined()

    const config = await redirectsPlugin!({ collections: [] } as unknown as Config)
    const redirectsCollection = config.collections?.find(
      (collection) => collection.slug === 'redirects',
    )

    expect(redirectsCollection?.hooks?.afterChange).toContain(revalidateRedirects)
    expect(redirectsCollection?.hooks?.afterDelete).toContain(
      revalidateRedirectsAfterDelete,
    )
  })
})
