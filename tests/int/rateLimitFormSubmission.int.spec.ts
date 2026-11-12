import { describe, expect, it, vi } from 'vitest'
import { APIError } from 'payload'
import { rateLimitFormSubmissionBeforeChange } from '@/hooks/rateLimitFormSubmission'

const WINDOW_MS = 15 * 60 * 1000

type MockDatabaseOptions = {
  indexError?: Error
}

const createMockDatabase = ({ indexError }: MockDatabaseOptions = {}) => {
  const records = new Map<string, Date>()
  const database = {
    collection: () => ({
      createIndex: async () => {
        if (indexError) throw indexError
        return 'index'
      },
      updateOne: async (
        filter: { key: string; expiresAt: { $lte: Date } },
        update: { $set: { expiresAt: Date } },
      ) => {
        const currentExpiry = records.get(filter.key)
        if (currentExpiry && currentExpiry.getTime() <= filter.expiresAt.$lte.getTime()) {
          records.set(filter.key, update.$set.expiresAt)
          return { matchedCount: 1 }
        }

        return { matchedCount: 0 }
      },
      insertOne: async ({ key, expiresAt }: { key: string; expiresAt: Date }) => {
        if (records.has(key)) {
          throw Object.assign(new Error('Duplicate key'), { code: 11000 })
        }

        records.set(key, expiresAt)
        return { acknowledged: true }
      },
    }),
  }

  return { database, records }
}

const submit = async ({
  database,
  api = 'REST',
  ip = '203.0.113.8',
  omitIP = false,
  userID,
}: {
  database: ReturnType<typeof createMockDatabase>['database']
  api?: string
  ip?: string
  omitIP?: boolean
  userID?: string
}) => {
  const headers = new Headers()
  if (!omitIP && ip) headers.set('x-forwarded-for', ip)

  return rateLimitFormSubmissionBeforeChange({
    data: { form: 'contact' },
    operation: 'create',
    req: {
      headers,
      payloadAPI: api,
      user: userID ? { id: userID } : null,
      payload: { db: { connection: { db: database } } },
    },
  } as never)
}

const expectRateLimited = (promise: Promise<unknown>) =>
  expect(promise).rejects.toMatchObject({ status: 429 } satisfies Partial<APIError>)

describe('Form Builder submission rate limiting', () => {
  it.each(['REST', 'GraphQL'])('limits public %s requests to five per IP', async (api) => {
    const { database } = createMockDatabase()

    for (let request = 0; request < 5; request += 1) {
      await expect(submit({ database, api })).resolves.toEqual({ form: 'contact' })
    }

    await expectRateLimited(submit({ database, api }))
  })

  it('shares the IP quota between REST and GraphQL', async () => {
    const { database } = createMockDatabase()

    for (let request = 0; request < 3; request += 1) {
      await submit({ database, api: 'REST' })
    }
    for (let request = 0; request < 2; request += 1) {
      await submit({ database, api: 'GraphQL' })
    }

    await expectRateLimited(submit({ database, api: 'REST' }))
  })

  it.each(['REST', 'GraphQL'])(
    'limits authenticated %s requests to twenty per user',
    async (api) => {
      const { database } = createMockDatabase()

      for (let request = 0; request < 20; request += 1) {
        await expect(
          submit({
            database,
            api,
            ip: `203.0.113.${request + 1}`,
            userID: 'user-1',
          }),
        ).resolves.toEqual({ form: 'contact' })
      }

      await expectRateLimited(
        submit({ database, api, ip: '203.0.113.21', userID: 'user-1' }),
      )
    },
  )

  it('also applies the IP quota to authenticated requests', async () => {
    const { database } = createMockDatabase()

    for (let request = 0; request < 5; request += 1) {
      await submit({ database, userID: 'user-1' })
    }

    await expectRateLimited(submit({ database, userID: 'user-1' }))
  })

  it('does not let different users sharing an IP bypass the IP quota', async () => {
    const { database } = createMockDatabase()

    for (let request = 0; request < 5; request += 1) {
      await submit({ database, userID: `user-${request + 1}` })
    }

    await expectRateLimited(submit({ database, userID: 'user-6' }))
  })

  it('does not automatically bypass Local API requests', async () => {
    const { database } = createMockDatabase()

    for (let request = 0; request < 5; request += 1) {
      await submit({ database, api: 'local' })
    }

    await expectRateLimited(submit({ database, api: 'local' }))
  })

  it('fails closed when the MongoDB rate-limit store fails', async () => {
    const error = new Error('MongoDB unavailable')
    const { database } = createMockDatabase({ indexError: error })

    await expect(submit({ database })).rejects.toBe(error)
  })

  it('rejects requests with a missing or invalid IP', async () => {
    for (const options of [{ omitIP: true }, { ip: 'not-an-ip' }]) {
      const { database, records } = createMockDatabase()

      await expect(submit({ database, ...options })).rejects.toMatchObject({
        status: 503,
      } satisfies Partial<APIError>)
      expect(records.size).toBe(0)
    }
  })

  it('does not exceed the IP quota under concurrent requests', async () => {
    const { database } = createMockDatabase()
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, () => submit({ database })),
    )

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(5)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(25)
  })

  it('does not exceed the user quota under concurrent requests from different IPs', async () => {
    const { database } = createMockDatabase()
    const results = await Promise.allSettled(
      Array.from({ length: 40 }, (_, request) =>
        submit({
          database,
          ip: `203.0.113.${request + 1}`,
          userID: 'user-1',
        }),
      ),
    )

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(20)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(20)
  })

  it('releases reserved slots after the 15-minute window', async () => {
    const { database } = createMockDatabase()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(0))

    try {
      for (let request = 0; request < 5; request += 1) {
        await submit({ database })
      }
      await expectRateLimited(submit({ database }))

      vi.setSystemTime(new Date(WINDOW_MS + 1))
      await expect(submit({ database })).resolves.toEqual({ form: 'contact' })
    } finally {
      vi.useRealTimers()
    }
  })
})
