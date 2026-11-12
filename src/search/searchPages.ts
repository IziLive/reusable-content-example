import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'
import type { Page } from '@/payload-types'
import { normalizeSearchText } from '@/search/normalize'

const RESULTS_PER_PAGE = 20
const SEARCH_BATCH_SIZE = 100
const MAX_QUERY_LENGTH = 200
export const MAX_SEARCH_PAGE = 100

type SearchDocument = {
  doc?: {
    relationTo?: string
    value?: unknown
  } | null
}

type SearchFindOptions = {
  collection: 'search'
  depth: 0
  limit: number
  overrideAccess: true
  page: number
  select: { doc: true }
  sort: string | string[]
  where: Where
}

type SearchFindResult = {
  docs: SearchDocument[]
  hasNextPage: boolean
}

type SearchPayloadBridge = {
  find: (options: SearchFindOptions) => Promise<SearchFindResult>
}

type VerifiedPageFields = Pick<Page, 'id' | 'title' | 'slug'> & {
  _status?: Page['_status']
  meta?: Page['meta']
}

export type PublicSearchResult = {
  id: string
  title: string
  slug: string
  description: string
  url: string
}

export type SearchPagesResult = {
  results: PublicSearchResult[]
  hasNextPage: boolean
  query: string
}

function getRelationshipID(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = value.id
    if (typeof id === 'string' && id.length > 0) {
      return id
    }
    if (typeof id === 'number' && Number.isFinite(id)) {
      return String(id)
    }
  }

  return null
}

function normalizeQuery(value: string): string {
  return [...normalizeSearchText(value)].slice(0, MAX_QUERY_LENGTH).join('').trim()
}

function getRequestedPage(page: number): number | null {
  if (!Number.isSafeInteger(page) || page <= 0 || page > MAX_SEARCH_PAGE) {
    return null
  }

  return page
}

function buildSearchWhere(words: string[]): Where {
  return {
    and: words.map((word) => ({
      searchableText: {
        contains: word,
      },
    })),
  }
}

function toPublicResult(page: VerifiedPageFields): PublicSearchResult {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    description: page.meta?.description ?? '',
    url: page.slug === 'home' ? '/' : `/${page.slug}`,
  }
}

export async function searchPages(
  input: string,
  requestedPage = 1,
): Promise<SearchPagesResult> {
  const query = normalizeQuery(input)
  const pageNumber = getRequestedPage(requestedPage)

  if (query.length < 2 || pageNumber === null) {
    return { results: [], hasNextPage: false, query }
  }

  const pageOffset = (pageNumber - 1) * RESULTS_PER_PAGE
  const requiredResults = pageOffset + RESULTS_PER_PAGE + 1

  if (!Number.isSafeInteger(pageOffset) || !Number.isSafeInteger(requiredResults)) {
    return { results: [], hasNextPage: false, query }
  }

  const words = [...new Set(query.split(' ').filter(Boolean))]
  const payload = await getPayload({ config: configPromise })
  const searchPayload = payload as unknown as SearchPayloadBridge
  const verifiedPages: VerifiedPageFields[] = []
  const seenPageIDs = new Set<string>()
  let searchPage = 1

  while (verifiedPages.length < requiredResults) {
    const searchResult = await searchPayload.find({
      collection: 'search',
      depth: 0,
      limit: SEARCH_BATCH_SIZE,
      overrideAccess: true,
      page: searchPage,
      select: { doc: true },
      sort: ['-priority', '-id'],
      where: buildSearchWhere(words),
    })

    if (searchResult.docs.length === 0) {
      break
    }

    const candidateIDs: string[] = []

    for (const searchDocument of searchResult.docs) {
      if (searchDocument.doc?.relationTo !== 'pages') {
        continue
      }

      const id = getRelationshipID(searchDocument.doc.value)
      if (id && !seenPageIDs.has(id)) {
        seenPageIDs.add(id)
        candidateIDs.push(id)
      }
    }

    if (candidateIDs.length > 0) {
      const pageResult = await payload.find({
        collection: 'pages',
        depth: 0,
        draft: false,
        limit: candidateIDs.length,
        overrideAccess: false,
        pagination: false,
        select: {
          _status: true,
          title: true,
          slug: true,
          meta: {
            description: true,
          },
        },
        where: {
          and: [
            { _status: { equals: 'published' } },
            { id: { in: candidateIDs } },
          ],
        },
      })

      const accessiblePages = new Map(
        pageResult.docs
          .filter((page) => page._status === 'published')
          .map((page) => [page.id, page]),
      )

      for (const id of candidateIDs) {
        const page = accessiblePages.get(id)
        if (page) {
          verifiedPages.push(page)
        }
      }
    }

    if (!searchResult.hasNextPage) {
      break
    }

    searchPage += 1
  }

  const results = verifiedPages
    .slice(pageOffset, pageOffset + RESULTS_PER_PAGE)
    .map(toPublicResult)

  return {
    results,
    hasNextPage: verifiedPages.length > pageOffset + RESULTS_PER_PAGE,
    query,
  }
}
