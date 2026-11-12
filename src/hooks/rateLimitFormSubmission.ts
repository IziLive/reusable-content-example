import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { APIError, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'
import type { FormSubmission } from '@/payload-types'

const MAX_IP_SUBMISSIONS = 5
const MAX_USER_SUBMISSIONS = 20
const WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_COLLECTION = 'form_submission_rate_limits'

const ttlIndexes = new WeakMap<object, Promise<void>>()

export const getTrustedClientIP = (headers: Headers): string | undefined => {
  const forwardedFor = headers.get('x-forwarded-for')
  const address = forwardedFor
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1)

  return address && isIP(address) ? address : undefined
}

type ReserveCounter = (key: string, now: number, expiresAt: Date) => Promise<boolean>

const hashRateLimitIdentity = (scope: 'ip' | 'user', identity: string): string =>
  createHash('sha256').update(`${scope}\0${identity}`).digest('hex')

const reserveSlots = async ({
  key,
  limit,
  now,
  expiresAt,
  reserve,
}: {
  key: string
  limit: number
  now: number
  expiresAt: Date
  reserve: ReserveCounter
}): Promise<void> => {
  for (let slot = 0; slot < limit; slot += 1) {
    if (await reserve(`${key}:${slot}`, now, expiresAt)) return
  }

  throw new APIError('Too many submissions. Please try again later.', 429, null, true)
}

export const enforceFormSubmissionRateLimit = async ({
  ip,
  userID,
  now,
  reserve,
}: {
  ip: string
  userID?: string
  now: number
  reserve: ReserveCounter
}): Promise<void> => {
  const expiresAt = new Date(now + WINDOW_MS)

  await reserveSlots({
    key: `ip:${hashRateLimitIdentity('ip', ip)}`,
    limit: MAX_IP_SUBMISSIONS,
    now,
    expiresAt,
    reserve,
  })

  if (userID) {
    await reserveSlots({
      key: `user:${hashRateLimitIdentity('user', userID)}`,
      limit: MAX_USER_SUBMISSIONS,
      now,
      expiresAt,
      reserve,
    })
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const reserveMongoCounter = async (
  req: PayloadRequest,
  key: string,
  now: number,
  expiresAt: Date,
): Promise<boolean> => {
  const database = req.payload.db.connection.db
  if (!database) {
    throw new Error('The MongoDB connection is not available for form submission rate limiting.')
  }

  const collection = database.collection(RATE_LIMIT_COLLECTION)
  let indexPromise = ttlIndexes.get(database)
  if (!indexPromise) {
    indexPromise = Promise.all([
      collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      collection.createIndex({ key: 1 }, { unique: true }),
    ])
      .then(() => undefined)
      .catch((error: unknown) => {
        ttlIndexes.delete(database)
        throw error
      })
    ttlIndexes.set(database, indexPromise)
  }
  await indexPromise

  const nowDate = new Date(now)
  const result = await collection.updateOne(
    { key, expiresAt: { $lte: nowDate } },
    { $set: { expiresAt } },
  )
  if (result.matchedCount === 1) return true

  try {
    await collection.insertOne({ key, expiresAt })
    return true
  } catch (error) {
    if (!isRecord(error) || error.code !== 11000) throw error
    return false
  }
}

export const rateLimitFormSubmissionBeforeChange: CollectionBeforeChangeHook<FormSubmission> =
  async ({ data, operation, req }) => {
    if (operation !== 'create') return data

    const ip = getTrustedClientIP(req.headers)

    if (!ip) {
      throw new APIError(
        'A trusted client IP address is required for form submissions.',
        503,
        null,
        true,
      )
    }

    const userID = req.user?.id
    if (req.user && (typeof userID !== 'string' || userID.length === 0)) {
      throw new APIError(
        'A valid user identity is required for authenticated form submissions.',
        503,
        null,
        true,
      )
    }

    await enforceFormSubmissionRateLimit({
      ip,
      userID,
      now: Date.now(),
      reserve: (key, now, expiresAt) => reserveMongoCounter(req, key, now, expiresAt),
    })

    return data
  }
