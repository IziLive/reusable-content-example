import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { normalizeSearchText } from '@/search/normalize'
import { searchPages } from '@/search/searchPages'

vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))

type MockSearchDocument = {
  doc?: { relationTo?: string; value?: unknown } | null
  priority?: number
}

type MockPage = {
  id: string
  title: string
  slug: string
  _status?: 'draft' | 'published' | null
  meta?: { description?: string | null } | null
}

type SearchFindOptions = {
  collection: 'search'
  limit: number
  page: number
  sort: string | string[]
  where: {
    and: { searchableText: { contains: string } }[]
  }
}

type PagesFindOptions = {
  collection: 'pages'
  draft: false
  limit: number
  overrideAccess: false
  pagination: false
  select: {
    title: true
    slug: true
    meta: { description: true }
  }
  where: {
    and: [
      { _status: { equals: 'published' } },
      { id: { in: string[] } },
    ]
  }
}

type MockFindOptions = SearchFindOptions | PagesFindOptions

function searchDocument(
  relationTo: string,
  value: unknown,
): MockSearchDocument {
  return { doc: { relationTo, value } }
}

function page(
  id: string,
  options: Partial<MockPage> = {},
): MockPage {
  return {
    id,
    title: `Title ${id}`,
    slug: `slug-${id}`,
    _status: 'published',
    meta: { description: `Description ${id}` },
    ...options,
  }
}

function setupLocalAPI({
  searchBatches,
  pages = [],
  allowedPageIDs,
  returnUnpublishedPageIDs = [],
  searchError,
  pagesError,
}: {
  searchBatches: MockSearchDocument[][]
  pages?: MockPage[]
  allowedPageIDs?: string[]
  returnUnpublishedPageIDs?: string[]
  searchError?: Error
  pagesError?: Error
}) {
  const find = vi.fn(async (options: MockFindOptions) => {
    if (options.collection === 'search') {
      if (searchError) {
        throw searchError
      }

      const docs = searchBatches[options.page - 1] ?? []
      return {
        docs,
        hasNextPage: options.page < searchBatches.length,
      }
    }

    if (pagesError) {
      throw pagesError
    }

    const requestedIDs = options.where.and[1].id.in
    const availableIDs = allowedPageIDs
      ? new Set(allowedPageIDs)
      : new Set(pages.map(({ id }) => id))
    const unpublishedIDs = new Set(returnUnpublishedPageIDs)
    const docs = pages.filter(
      (candidate) =>
        requestedIDs.includes(candidate.id) &&
        availableIDs.has(candidate.id) &&
        (candidate._status === 'published' || unpublishedIDs.has(candidate.id)),
    )

    return { docs }
  })

  const payload = { find } as unknown as Payload
  vi.mocked(getPayload).mockResolvedValue(payload)
  return { find, payload }
}

describe('searchPages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes and searches Russian words', async () => {
    const api = setupLocalAPI({
      searchBatches: [[searchDocument('pages', 'page-1')]],
      pages: [page('page-1')],
    })

    const result = await searchPages('  ПРИВЕТ   МИР ')

    expect(result.query).toBe('привет мир')
    expect(api.find.mock.calls[0][0]).toMatchObject({
      collection: 'search',
      overrideAccess: true,
      where: {
        and: [
          { searchableText: { contains: 'привет' } },
          { searchableText: { contains: 'мир' } },
        ],
      },
    })
  })

  it('normalizes and searches English words', async () => {
    const api = setupLocalAPI({ searchBatches: [[]] })

    const result = await searchPages('  SEARCH   PAGE ')

    expect(result.query).toBe('search page')
    expect(api.find.mock.calls[0][0]).toMatchObject({
      where: {
        and: [
          { searchableText: { contains: 'search' } },
          { searchableText: { contains: 'page' } },
        ],
      },
    })
  })

  it('keeps mixed Cyrillic and Latin terms in the query', async () => {
    const api = setupLocalAPI({ searchBatches: [[]] })

    const result = await searchPages('Тест Payload')

    expect(result.query).toBe('тест payload')
    expect(api.find.mock.calls[0][0]).toMatchObject({
      where: {
        and: [
          { searchableText: { contains: 'тест' } },
          { searchableText: { contains: 'payload' } },
        ],
      },
    })
  })

  it('normalizes Ё and Е consistently', async () => {
    const api = setupLocalAPI({ searchBatches: [[]] })

    const result = await searchPages('Ёлка ЕЛКА')

    expect(result.query).toBe('елка елка')
    expect(api.find.mock.calls[0][0]).toMatchObject({
      where: { and: [{ searchableText: { contains: 'елка' } }] },
    })
  })

  it('does not call Local API for an empty query', async () => {
    const api = setupLocalAPI({ searchBatches: [[]] })

    const result = await searchPages('  !!! ')

    expect(result).toEqual({ results: [], hasNextPage: false, query: '' })
    expect(api.find).not.toHaveBeenCalled()
  })

  it('does not search a normalized query shorter than two characters', async () => {
    const api = setupLocalAPI({ searchBatches: [[]] })

    const result = await searchPages(' Ё ')

    expect(result).toEqual({ results: [], hasNextPage: false, query: 'е' })
    expect(api.find).not.toHaveBeenCalled()
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negative Infinity', Number.NEGATIVE_INFINITY],
    ['zero', 0],
    ['a negative number', -1],
    ['a fractional number', 1.5],
    ['an unsafe finite number', Number.MAX_SAFE_INTEGER + 1],
  ])('does not search with %s as the requested page', async (_description, pageNumber) => {
    const api = setupLocalAPI({ searchBatches: [[]] })

    const result = await searchPages('valid query', pageNumber)

    expect(result).toEqual({ results: [], hasNextPage: false, query: 'valid query' })
    expect(api.find).not.toHaveBeenCalled()
    expect(getPayload).not.toHaveBeenCalled()
  })

  it('allows the maximum search page and performs the search', async () => {
    const api = setupLocalAPI({ searchBatches: [[]] })

    const result = await searchPages('valid query', 100)

    expect(result).toEqual({ results: [], hasNextPage: false, query: 'valid query' })
    expect(getPayload).toHaveBeenCalledOnce()
    expect(api.find).toHaveBeenCalledOnce()
    expect(api.find.mock.calls[0]?.[0]).toMatchObject({
      collection: 'search',
      page: 1,
      limit: 100,
    })
  })

  it('rejects page 101 before loading Payload', async () => {
    const api = setupLocalAPI({ searchBatches: [[]] })

    const result = await searchPages('valid query', 101)

    expect(result).toEqual({ results: [], hasNextPage: false, query: 'valid query' })
    expect(getPayload).not.toHaveBeenCalled()
    expect(api.find).not.toHaveBeenCalled()
  })

  it('rejects a very large safe page number before loading Payload', async () => {
    const api = setupLocalAPI({ searchBatches: [[]] })
    const pageNumber = Number.MAX_SAFE_INTEGER - 1

    expect(Number.isSafeInteger(pageNumber)).toBe(true)

    const result = await searchPages('valid query', pageNumber)

    expect(result).toEqual({ results: [], hasNextPage: false, query: 'valid query' })
    expect(getPayload).not.toHaveBeenCalled()
    expect(api.find).not.toHaveBeenCalled()
  })

  it('does not search when a safe page number produces an unsafe offset', async () => {
    const api = setupLocalAPI({ searchBatches: [[]] })

    const result = await searchPages('valid query', Number.MAX_SAFE_INTEGER)

    expect(result).toEqual({ results: [], hasNextPage: false, query: 'valid query' })
    expect(api.find).not.toHaveBeenCalled()
    expect(getPayload).not.toHaveBeenCalled()
  })

  it('does not search when required results are unsafe but the offset is safe', async () => {
    const api = setupLocalAPI({ searchBatches: [[]] })
    const pageNumber = Number(BigInt(Number.MAX_SAFE_INTEGER) / 20n + 1n)
    const pageOffset = (pageNumber - 1) * 20

    expect(Number.isSafeInteger(pageOffset)).toBe(true)
    expect(Number.isSafeInteger(pageOffset + 21)).toBe(false)

    const result = await searchPages('valid query', pageNumber)

    expect(result).toEqual({ results: [], hasNextPage: false, query: 'valid query' })
    expect(api.find).not.toHaveBeenCalled()
    expect(getPayload).not.toHaveBeenCalled()
  })

  it('caps the normalized query length', async () => {
    const api = setupLocalAPI({ searchBatches: [[]] })

    const result = await searchPages('A'.repeat(250))

    expect(result.query).toBe('a'.repeat(200))
    expect(api.find.mock.calls[0][0]).toMatchObject({
      where: {
        and: [{ searchableText: { contains: 'a'.repeat(200) } }],
      },
    })
  })

  it('checks Search for pages beyond the former candidate safety limit', async () => {
    const api = setupLocalAPI({ searchBatches: [[]] })

    const result = await searchPages('valid query', 26)

    expect(result).toEqual({ results: [], hasNextPage: false, query: 'valid query' })
    expect(api.find).toHaveBeenCalledOnce()
    expect(api.find.mock.calls[0]?.[0]).toMatchObject({
      collection: 'search',
      page: 1,
      limit: 100,
    })
  })

  it('deduplicates Search relationships before querying Pages', async () => {
    const api = setupLocalAPI({
      searchBatches: [[
        searchDocument('pages', 'page-1'),
        searchDocument('pages', 'page-1'),
      ]],
      pages: [page('page-1')],
    })

    const result = await searchPages('valid query')
    const pageFind = api.find.mock.calls[1][0]

    expect(result.results).toHaveLength(1)
    expect(pageFind.collection).toBe('pages')
    if (pageFind.collection === 'pages') {
      expect(pageFind.where.and[1].id.in).toEqual(['page-1'])
    }
  })

  it('ignores Search relationships that do not point to Pages', async () => {
    const api = setupLocalAPI({
      searchBatches: [[
        searchDocument('templates', 'template-1'),
        searchDocument('pages', 'page-1'),
      ]],
      pages: [page('page-1')],
    })

    const result = await searchPages('valid query')

    expect(result.results.map(({ id }) => id)).toEqual(['page-1'])
    const pageFind = api.find.mock.calls[1][0]
    if (pageFind.collection === 'pages') {
      expect(pageFind.where.and[1].id.in).toEqual(['page-1'])
    }
  })

  it('requests Pages only as published with access checks enabled', async () => {
    const api = setupLocalAPI({
      searchBatches: [[searchDocument('pages', 'page-1')]],
      pages: [page('page-1')],
    })

    await searchPages('valid query')

    const pageFind = api.find.mock.calls.find(
      ([options]) => options.collection === 'pages',
    )?.[0]
    expect(pageFind).toMatchObject({
      collection: 'pages',
      draft: false,
      overrideAccess: false,
      where: {
        and: [
          { _status: { equals: 'published' } },
          { id: { in: ['page-1'] } },
        ],
      },
    })
  })

  it('excludes draft Pages even if returned by the mocked Local API', async () => {
    const api = setupLocalAPI({
      searchBatches: [[searchDocument('pages', 'draft-page')]],
      pages: [page('draft-page', { _status: 'draft' })],
      returnUnpublishedPageIDs: ['draft-page'],
    })

    const result = await searchPages('valid query')

    const pageFindIndex = api.find.mock.calls.findIndex(
      ([options]) => options.collection === 'pages',
    )
    const pageFindOptions = api.find.mock.calls[pageFindIndex]?.[0]
    expect(pageFindOptions).toMatchObject({
      collection: 'pages',
      draft: false,
      overrideAccess: false,
      where: {
        and: [
          { _status: { equals: 'published' } },
          { id: { in: ['draft-page'] } },
        ],
      },
    })
    await expect(api.find.mock.results[pageFindIndex]?.value).resolves.toMatchObject({
      docs: [expect.objectContaining({ id: 'draft-page', _status: 'draft' })],
    })
    expect(result.results).toEqual([])
    expect(api.find).toHaveBeenCalledTimes(2)
  })

  it('excludes deleted or inaccessible Pages not returned by Local API', async () => {
    const api = setupLocalAPI({
      searchBatches: [[
        searchDocument('pages', 'deleted-page'),
        searchDocument('pages', 'inaccessible-page'),
      ]],
      pages: [],
      allowedPageIDs: [],
    })

    const result = await searchPages('valid query')

    expect(result.results).toEqual([])
    expect(api.find).toHaveBeenCalledTimes(2)
  })

  it('excludes Pages that are no longer published', async () => {
    const api = setupLocalAPI({
      searchBatches: [[searchDocument('pages', 'unpublished-page')]],
      pages: [page('unpublished-page', { _status: null })],
    })

    const result = await searchPages('valid query')

    expect(result.results).toEqual([])
  })

  it('preserves Search order when the Pages query returns a different order', async () => {
    const api = setupLocalAPI({
      searchBatches: [[
        searchDocument('pages', 'page-1'),
        searchDocument('pages', 'page-2'),
      ]],
      pages: [page('page-2'), page('page-1')],
    })

    const result = await searchPages('valid query')

    expect(result.results.map(({ id }) => id)).toEqual(['page-1', 'page-2'])
  })

  it('creates safe DTOs and correct URLs for home and regular Pages', async () => {
    const api = setupLocalAPI({
      searchBatches: [[
        searchDocument('pages', 'home-page'),
        searchDocument('pages', 'about-page'),
      ]],
      pages: [
        page('home-page', { slug: 'home', title: 'Home', meta: { description: 'Home description' } }),
        page('about-page', { slug: 'about', title: 'About', meta: { description: 'About description' } }),
      ],
    })

    const result = await searchPages('valid query')

    expect(result.results).toEqual([
      {
        id: 'home-page',
        title: 'Home',
        slug: 'home',
        description: 'Home description',
        url: '/',
      },
      {
        id: 'about-page',
        title: 'About',
        slug: 'about',
        description: 'About description',
        url: '/about',
      },
    ])
    expect(Object.keys(result.results[0] ?? {}).sort()).toEqual([
      'description',
      'id',
      'slug',
      'title',
      'url',
    ])
    expect(api.find).toHaveBeenCalled()
  })

  it('fills one result page from subsequent candidate batches', async () => {
    const staleBatch = Array.from({ length: 100 }, (_, index) =>
      searchDocument('pages', `stale-${index}`),
    )
    const nextBatch = Array.from({ length: 21 }, (_, index) =>
      searchDocument('pages', `live-${index}`),
    )
    const api = setupLocalAPI({
      searchBatches: [staleBatch, nextBatch],
      pages: Array.from({ length: 21 }, (_, index) => page(`live-${index}`)),
    })

    const result = await searchPages('valid query')

    expect(api.find.mock.calls.filter(([options]) => options.collection === 'search')).toHaveLength(2)
    expect(result.results).toHaveLength(20)
    expect(result.results[0]?.id).toBe('live-0')
    expect(result.hasNextPage).toBe(true)
  })

  it('returns exactly 20 published results without a next page', async () => {
    const searchBatches = [
      Array.from({ length: 20 }, (_, index) =>
        searchDocument('pages', `page-${index + 1}`),
      ),
    ]
    const api = setupLocalAPI({
      searchBatches,
      pages: Array.from({ length: 20 }, (_, index) => page(`page-${index + 1}`)),
    })

    const result = await searchPages('valid query')

    expect(result.results).toHaveLength(20)
    expect(result.hasNextPage).toBe(false)
    expect(api.find.mock.calls.filter(([options]) => options.collection === 'search'))
      .toHaveLength(1)
  })

  it('sets hasNextPage when there are 21 published results', async () => {
    const api = setupLocalAPI({
      searchBatches: [
        Array.from({ length: 21 }, (_, index) =>
          searchDocument('pages', `page-${index + 1}`),
        ),
      ],
      pages: Array.from({ length: 21 }, (_, index) => page(`page-${index + 1}`)),
    })

    const result = await searchPages('valid query')

    expect(result.results).toHaveLength(20)
    expect(result.hasNextPage).toBe(true)
  })

  it('paginates 100 published results without repeats or gaps', async () => {
    const allSearchDocuments = Array.from({ length: 100 }, (_, index) =>
      searchDocument('pages', `page-${String(index + 1).padStart(3, '0')}`),
    )
    const searchBatches = [allSearchDocuments]
    const pages = Array.from({ length: 100 }, (_, index) =>
      page(`page-${String(index + 1).padStart(3, '0')}`),
    )
    const resultsByPage = []
    const hasNextByPage = []
    const apis = []

    for (let pageNumber = 1; pageNumber <= 5; pageNumber++) {
      apis.push(setupLocalAPI({ searchBatches, pages }))
      const result = await searchPages('valid query', pageNumber)
      resultsByPage.push(...result.results.map(({ id }) => id))
      hasNextByPage.push(result.hasNextPage)
    }

    expect(resultsByPage).toEqual(pages.map(({ id }) => id))
    expect(hasNextByPage).toEqual([true, true, true, true, false])
    for (const api of apis) {
      expect(api.find.mock.calls.filter(([options]) => options.collection === 'search'))
        .toHaveLength(1)
      const pagesFind = api.find.mock.calls.find(([options]) => options.collection === 'pages')
      expect(pagesFind?.[0]).toMatchObject({
        collection: 'pages',
        limit: 100,
        pagination: false,
        overrideAccess: false,
      })
    }
  })

  it('continues past 500 stale candidates to find published Pages', async () => {
    const staleBatches = Array.from({ length: 5 }, (_, batchIndex) =>
      Array.from({ length: 100 }, (_, index) =>
        searchDocument('pages', `stale-${batchIndex * 100 + index}`),
      ),
    )
    const livePages = Array.from({ length: 21 }, (_, index) =>
      page(`live-${index}`),
    )
    const api = setupLocalAPI({
      searchBatches: [
        ...staleBatches,
        livePages.map(({ id }) => searchDocument('pages', id)),
      ],
      pages: livePages,
      allowedPageIDs: livePages.map(({ id }) => id),
    })

    const result = await searchPages('valid query')
    const searchCalls = api.find.mock.calls.filter(
      ([options]) => options.collection === 'search',
    )

    expect(searchCalls).toHaveLength(6)
    expect(
      searchCalls.map(([options]) =>
        options.collection === 'search' ? options.page : undefined,
      ),
    ).toEqual([1, 2, 3, 4, 5, 6])
    expect(searchCalls.every(([options]) => options.limit === 100)).toBe(true)
    expect(result.results.map(({ id }) => id)).toEqual(
      livePages.slice(0, 20).map(({ id }) => id),
    )
    expect(result.hasNextPage).toBe(true)
  })

  it('stops after the batch that fills offset plus 21 results', async () => {
    const staleBatches = Array.from({ length: 5 }, (_, batchIndex) =>
      Array.from({ length: 100 }, (_, index) =>
        searchDocument('pages', `stale-${batchIndex * 100 + index}`),
      ),
    )
    const livePages = Array.from({ length: 41 }, (_, index) =>
      page(`live-${index}`),
    )
    const finalBatch = [
      ...livePages.map(({ id }) => searchDocument('pages', id)),
      ...Array.from({ length: 59 }, (_, index) =>
        searchDocument('categories', `category-${index}`),
      ),
    ]
    const api = setupLocalAPI({
      searchBatches: [
        ...staleBatches,
        finalBatch,
        [searchDocument('pages', 'must-not-be-read')],
      ],
      pages: livePages,
      allowedPageIDs: livePages.map(({ id }) => id),
    })

    const result = await searchPages('valid query', 2)
    const searchCalls = api.find.mock.calls.filter(
      ([options]) => options.collection === 'search',
    )

    expect(searchCalls).toHaveLength(6)
    expect(result.results.map(({ id }) => id)).toEqual(
      livePages.slice(20, 40).map(({ id }) => id),
    )
    expect(result.hasNextPage).toBe(true)
  })

  it('returns all available pages when Search ends before filling the requested page', async () => {
    const availablePages = Array.from({ length: 25 }, (_, index) =>
      page(`page-${index + 1}`),
    )
    const api = setupLocalAPI({
      searchBatches: [
        availablePages.map(({ id }) => searchDocument('pages', id)),
      ],
      pages: availablePages,
    })

    const result = await searchPages('valid query', 2)

    expect(result.results.map(({ id }) => id)).toEqual(
      availablePages.slice(20).map(({ id }) => id),
    )
    expect(result.hasNextPage).toBe(false)
    expect(api.find.mock.calls.filter(([options]) => options.collection === 'search'))
      .toHaveLength(1)
  })

  it('stops when an empty Search batch reports a next page', async () => {
    const api = setupLocalAPI({
      searchBatches: [[], []],
    })
    api.find.mockImplementation(async (options) => {
      if (options.collection === 'search') {
        return { docs: [], hasNextPage: true }
      }

      return { docs: [] }
    })

    const result = await searchPages('valid query')
    const searchCalls = api.find.mock.calls.filter(
      ([options]) => options.collection === 'search',
    )

    expect(searchCalls).toHaveLength(1)
    expect(
      searchCalls.map(([options]) =>
        options.collection === 'search' ? options.page : undefined,
      ),
    ).toEqual([1])
    expect(result).toEqual({ results: [], hasNextPage: false, query: 'valid query' })
  })

  it('deduplicates Page IDs within and across batches without pagination gaps', async () => {
    const firstBatchIDs = Array.from({ length: 19 }, (_, index) => `page-${index}`)
    const secondBatchIDs = Array.from({ length: 20 }, (_, index) => `page-${index + 19}`)
    const searchBatches = [
      [
        ...firstBatchIDs.map((id) => searchDocument('pages', id)),
        searchDocument('pages', 'page-0'),
      ],
      [
        searchDocument('pages', 'page-18'),
        ...secondBatchIDs.map((id) => searchDocument('pages', id)),
      ],
    ]
    const pages = Array.from({ length: 39 }, (_, index) => page(`page-${index}`))
    const firstAPI = setupLocalAPI({ searchBatches, pages })
    const firstPage = await searchPages('valid query', 1)
    const secondAPI = setupLocalAPI({ searchBatches, pages })
    const secondPage = await searchPages('valid query', 2)

    expect(firstPage.results.map(({ id }) => id)).toEqual(
      pages.slice(0, 20).map(({ id }) => id),
    )
    expect(secondPage.results.map(({ id }) => id)).toEqual(
      pages.slice(20).map(({ id }) => id),
    )
    expect(new Set([...firstPage.results, ...secondPage.results].map(({ id }) => id)).size)
      .toBe(39)
    expect(firstPage.hasNextPage).toBe(true)
    expect(secondPage.hasNextPage).toBe(false)
    expect(firstAPI.find.mock.calls.filter(([options]) => options.collection === 'search'))
      .toHaveLength(2)
    expect(secondAPI.find.mock.calls.filter(([options]) => options.collection === 'search'))
      .toHaveLength(2)
  })

  it('continues past deleted and unpublished Pages to published candidates', async () => {
    const stalePages = [
      ...Array.from({ length: 40 }, (_, index) =>
        page(`draft-${index}`, { _status: 'draft' }),
      ),
      ...Array.from({ length: 60 }, (_, index) => page(`deleted-${index}`)),
    ]
    const livePages = Array.from({ length: 21 }, (_, index) =>
      page(`live-${index}`),
    )
    const api = setupLocalAPI({
      searchBatches: [
        stalePages.map(({ id }) => searchDocument('pages', id)),
        livePages.map(({ id }) => searchDocument('pages', id)),
      ],
      pages: [...stalePages, ...livePages],
      allowedPageIDs: [
        ...stalePages.filter(({ id }) => id.startsWith('draft-')).map(({ id }) => id),
        ...livePages.map(({ id }) => id),
      ],
      returnUnpublishedPageIDs: stalePages
        .filter(({ id }) => id.startsWith('draft-'))
        .map(({ id }) => id),
    })

    const result = await searchPages('valid query')

    expect(result.results.map(({ id }) => id)).toEqual(
      livePages.slice(0, 20).map(({ id }) => id),
    )
    expect(result.hasNextPage).toBe(true)
    expect(api.find.mock.calls.filter(([options]) => options.collection === 'search'))
      .toHaveLength(2)
  })

  it('uses a stable ID tie-breaker after priority', async () => {
    const orderedIDs = Array.from({ length: 21 }, (_, index) =>
      `page-${String(21 - index).padStart(2, '0')}`,
    )
    const orderedSearchDocuments = orderedIDs.map((id) => ({
      ...searchDocument('pages', id),
      priority: 10,
    }))
    const api = setupLocalAPI({
      searchBatches: [orderedSearchDocuments],
      pages: orderedIDs.map((id) => page(id)),
    })

    const result = await searchPages('valid query')
    const searchOptions = api.find.mock.calls[0]?.[0]

    expect(searchOptions).toMatchObject({
      collection: 'search',
      sort: ['-priority', '-id'],
    })
    expect(result.results.map(({ id }) => id)).toEqual(orderedIDs.slice(0, 20))
    expect(result.hasNextPage).toBe(true)
  })

  it('propagates Search Local API errors', async () => {
    const error = new Error('Search query failed')
    setupLocalAPI({ searchBatches: [], searchError: error })

    await expect(searchPages('valid query')).rejects.toBe(error)
  })

  it('propagates Pages Local API errors', async () => {
    const error = new Error('Page access check failed')
    setupLocalAPI({
      searchBatches: [[searchDocument('pages', 'page-1')]],
      pagesError: error,
    })

    await expect(searchPages('valid query')).rejects.toBe(error)
  })

  it('never returns internal Search document fields', async () => {
    setupLocalAPI({
      searchBatches: [[
        {
          ...searchDocument('pages', 'page-1'),
          searchableText: 'private indexed text',
          priority: 100,
          internalSecret: 'not public',
        } as MockSearchDocument,
      ]],
      pages: [page('page-1')],
    })

    const result = await searchPages('valid query')
    const serialized = JSON.stringify(result)

    expect(serialized).not.toContain('searchableText')
    expect(serialized).not.toContain('private indexed text')
    expect(serialized).not.toContain('priority')
    expect(serialized).not.toContain('internalSecret')
    expect(result.results[0]).not.toHaveProperty('doc')
  })
})
