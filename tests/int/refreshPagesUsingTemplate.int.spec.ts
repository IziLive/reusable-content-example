import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Page, Template } from '@/payload-types'
import { refreshPagesUsingTemplate } from '@/search/refreshPagesUsingTemplate'

type MockPage = {
  id: string
  title: string
  _status: 'published'
  hero: { type: 'none' }
  layout: Record<string, unknown>[]
  meta: { title: string; description: string }
}

type MockTemplate = {
  id: string
  title: string
  content: Record<string, unknown>[]
}

type MockFindOptions = {
  page?: number
  collection?: string
  draft?: boolean
  overrideAccess?: boolean
  where?: unknown
}
type MockUpdateOptions = {
  collection: string
  data: { searchableText: string }
  where: unknown
}

function richText(text: string) {
  return {
    root: {
      type: 'root',
      version: 1,
      direction: null,
      format: '',
      indent: 0,
      children: [
        {
          type: 'paragraph',
          version: 1,
          direction: null,
          format: '',
          indent: 0,
          children: [
            {
              type: 'text',
              version: 1,
              text,
              format: 0,
              mode: 'normal',
              style: '',
            },
          ],
        },
      ],
    },
  }
}

function contentBlock(text: string): Record<string, unknown> {
  return { blockType: 'content', richText: richText(text) }
}

function reusableBlock(
  template: string,
  useTemplateValues: boolean,
  localText = '',
): Record<string, unknown> {
  return {
    blockType: 'reusableContent',
    template,
    useTemplateValues,
    content: localText ? [contentBlock(localText)] : [],
  }
}

function makePage(
  id: string,
  layout: Record<string, unknown>[],
  title = `Page ${id}`,
): Page {
  return {
    id,
    title,
    _status: 'published',
    hero: { type: 'none' },
    layout,
    meta: { title: '', description: '' },
  } as unknown as Page
}

function makeTemplate(id: string, title: string, text: string): Template {
  return {
    id,
    title,
    content: [contentBlock(text)],
  } as unknown as Template
}

function mockRequest({
  pages,
  templates = {},
  searchDocs = [{ id: 'search-doc' }],
  updateErrors = [],
  pageResults,
  findError,
  findByIDError,
}: {
  pages?: Page[]
  templates?: Record<string, Template | null>
  searchDocs?: unknown[]
  updateErrors?: { message: string }[]
  pageResults?: (pageNumber: number) => { docs: Page[]; hasNextPage: boolean }
  findError?: Error
  findByIDError?: Error
} = {}) {
  const find = vi.fn(async ({ page = 1 }: MockFindOptions) => {
    if (findError) {
      throw findError
    }

    return pageResults ? pageResults(page) : { docs: pages ?? [], hasNextPage: false }
  })

  const findByID = vi.fn(async ({ id }: { id: string }) => {
    if (findByIDError) {
      throw findByIDError
    }

    const result = templates[id]
    if (!result) {
      throw new Error(`Template '${id}' not found`)
    }
    return result
  })

  const update = vi.fn(async (_options: MockUpdateOptions) => ({
    docs: searchDocs,
    errors: updateErrors,
  }))
  const create = vi.fn()
  const req = {
    payload: { find, findByID, update, create },
  } as unknown as Parameters<typeof refreshPagesUsingTemplate>[0]['req']

  return { find, findByID, update, create, req }
}

describe('refreshPagesUsingTemplate', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('updates Search for a published Page using the changed Template values', async () => {
    const page = makePage('page-1', [reusableBlock('template-1', true)])
    const updatedTemplate = makeTemplate('template-1', 'Updated title', 'Updated body')
    const api = mockRequest({ pages: [page] })

    await refreshPagesUsingTemplate({
      templateID: updatedTemplate.id,
      template: updatedTemplate,
      req: api.req,
    })

    expect(api.update).toHaveBeenCalledOnce()
    expect(api.update.mock.calls[0][0].data.searchableText).toContain('updated body')
    expect(api.update.mock.calls[0][0].data.searchableText).not.toContain('updated title')
    expect(api.findByID).not.toHaveBeenCalled()
    expect(api.find.mock.calls[0][0]).toMatchObject({
      collection: 'pages',
      draft: false,
      overrideAccess: false,
      where: {
        and: [
          { _status: { equals: 'published' } },
          { 'layout.template': { equals: 'template-1' } },
        ],
      },
    })
  })

  it('does not update Search when the matching block uses local values', async () => {
    const page = makePage('page-local', [
      reusableBlock('template-1', false, 'Local content'),
    ])
    const api = mockRequest({ pages: [page] })

    await refreshPagesUsingTemplate({
      templateID: 'template-1',
      template: makeTemplate('template-1', 'Changed', 'Changed body'),
      req: api.req,
    })

    expect(api.update).not.toHaveBeenCalled()
  })

  it('preserves content from other Reusable Content Templates', async () => {
    const page = makePage('page-multiple', [
      reusableBlock('template-1', true),
      reusableBlock('template-2', true),
    ])
    const api = mockRequest({
      pages: [page],
      templates: { 'template-2': makeTemplate('template-2', 'Other title', 'Other body') },
    })

    await refreshPagesUsingTemplate({
      templateID: 'template-1',
      template: makeTemplate('template-1', 'Changed title', 'Changed body'),
      req: api.req,
    })

    const text = api.update.mock.calls[0][0].data.searchableText
    expect(text).toContain('changed body')
    expect(text).not.toContain('changed title')
    expect(text).toContain('other body')
    expect(text).not.toContain('other title')
  })

  it('preserves local Content blocks in the rebuilt text', async () => {
    const page = makePage('page-content', [
      reusableBlock('template-1', true),
      contentBlock('Local page content'),
    ])
    const api = mockRequest({ pages: [page] })

    await refreshPagesUsingTemplate({
      templateID: 'template-1',
      template: makeTemplate('template-1', 'Template title', 'Template body'),
      req: api.req,
    })

    const text = api.update.mock.calls[0][0].data.searchableText
    expect(text).toContain('local page content')
    expect(text).toContain('template body')
    expect(text).not.toContain('template title')
  })

  it('omits a deleted Template and preserves other block content', async () => {
    const page = makePage('page-deleted', [
      reusableBlock('template-deleted', true),
      reusableBlock('template-2', true),
      contentBlock('Local page content'),
    ])
    const api = mockRequest({
      pages: [page],
      templates: {
        'template-2': makeTemplate('template-2', 'Remaining title', 'Remaining body'),
      },
    })

    await refreshPagesUsingTemplate({
      templateID: 'template-deleted',
      req: api.req,
    })

    const text = api.update.mock.calls[0][0].data.searchableText
    expect(text).not.toContain('template-deleted')
    expect(text).toContain('remaining body')
    expect(text).not.toContain('remaining title')
    expect(text).toContain('local page content')
    expect(api.findByID).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'template-deleted' }),
    )
  })

  it('updates all Pages using the same Template', async () => {
    const pages = [
      makePage('page-1', [reusableBlock('template-1', true)]),
      makePage('page-2', [reusableBlock('template-1', true)]),
    ]
    const api = mockRequest({ pages })

    await refreshPagesUsingTemplate({
      templateID: 'template-1',
      template: makeTemplate('template-1', 'Shared title', 'Shared body'),
      req: api.req,
    })

    expect(api.update).toHaveBeenCalledTimes(2)
    expect(api.update.mock.calls.map(([args]) => args.where)).toEqual([
      {
        and: [
          { 'doc.relationTo': { equals: 'pages' } },
          { 'doc.value': { equals: 'page-1' } },
        ],
      },
      {
        and: [
          { 'doc.relationTo': { equals: 'pages' } },
          { 'doc.value': { equals: 'page-2' } },
        ],
      },
    ])
  })

  it('does not match a Template ID in a different block', async () => {
    const page = makePage('page-false-match', [
      reusableBlock('template-1', false, 'Local values'),
      reusableBlock('template-2', true),
    ])
    const api = mockRequest({ pages: [page] })

    await refreshPagesUsingTemplate({
      templateID: 'template-1',
      template: makeTemplate('template-1', 'Changed', 'Changed body'),
      req: api.req,
    })

    expect(api.update).not.toHaveBeenCalled()
  })

  it('warns and does not create a Search record when none exists', async () => {
    const page = makePage('page-no-search', [reusableBlock('template-1', true)])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const api = mockRequest({ pages: [page], searchDocs: [] })

    await refreshPagesUsingTemplate({
      templateID: 'template-1',
      template: makeTemplate('template-1', 'Title', 'Body'),
      req: api.req,
    })

    expect(api.update).toHaveBeenCalledOnce()
    expect(api.create).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Search index entry is missing for Page 'page-no-search'"),
    )
  })

  it('throws a readable error when the bulk update returns errors', async () => {
    const page = makePage('page-error', [reusableBlock('template-1', true)])
    const api = mockRequest({
      pages: [page],
      updateErrors: [{ message: 'Search update failed' }],
    })

    await expect(
      refreshPagesUsingTemplate({
        templateID: 'template-1',
        template: makeTemplate('template-1', 'Title', 'Body'),
        req: api.req,
      }),
    ).rejects.toThrow("Failed to refresh Search index for Page 'page-error': Search update failed")
  })

  it('requests the next Page batch when hasNextPage is true', async () => {
    const firstPage = makePage('page-1', [reusableBlock('template-1', true)])
    const secondPage = makePage('page-2', [reusableBlock('template-1', true)])
    const api = mockRequest({
      pageResults: (pageNumber) =>
        pageNumber === 1
          ? { docs: [firstPage], hasNextPage: true }
          : { docs: [secondPage], hasNextPage: false },
    })

    await refreshPagesUsingTemplate({
      templateID: 'template-1',
      template: makeTemplate('template-1', 'Title', 'Body'),
      req: api.req,
    })

    expect(api.find.mock.calls.map(([args]) => args.page)).toEqual([1, 2])
    expect(api.update).toHaveBeenCalledTimes(2)
  })

  it('loads a shared Template only once across Pages in one invocation', async () => {
    const pages = [
      makePage('page-1', [
        reusableBlock('template-1', true),
        reusableBlock('template-other', true),
      ]),
      makePage('page-2', [
        reusableBlock('template-1', true),
        reusableBlock('template-other', true),
      ]),
    ]
    const api = mockRequest({
      pages,
      templates: {
        'template-other': makeTemplate('template-other', 'Other title', 'Other body'),
      },
    })

    await refreshPagesUsingTemplate({
      templateID: 'template-1',
      template: makeTemplate('template-1', 'Changed title', 'Changed body'),
      req: api.req,
    })

    expect(api.findByID).toHaveBeenCalledOnce()
    expect(api.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'template-other', collection: 'templates' }),
    )
    for (const [args] of api.update.mock.calls) {
      expect(args.data.searchableText).toContain('changed body')
      expect(args.data.searchableText).not.toContain('changed title')
      expect(args.data.searchableText).toContain('other body')
      expect(args.data.searchableText).not.toContain('other title')
    }
  })

  it('uses the supplied updated Template instead of loading it again', async () => {
    const page = makePage('page-current-template', [
      reusableBlock('template-1', true),
    ])
    const api = mockRequest({
      pages: [page],
      templates: {
        'template-1': makeTemplate('template-1', 'Stale title', 'Stale body'),
      },
    })

    await refreshPagesUsingTemplate({
      templateID: 'template-1',
      template: makeTemplate('template-1', 'Current title', 'Current body'),
      req: api.req,
    })

    const text = api.update.mock.calls[0][0].data.searchableText
    expect(text).toContain('current body')
    expect(text).not.toContain('current title')
    expect(text).not.toContain('stale title stale body')
    expect(api.findByID).not.toHaveBeenCalled()
  })

  it('throws when the supplied Template ID does not match templateID', async () => {
    const api = mockRequest()

    await expect(
      refreshPagesUsingTemplate({
        templateID: 'expected-id',
        template: makeTemplate('different-id', 'Title', 'Body'),
        req: api.req,
      }),
    ).rejects.toThrow("Template ID mismatch: expected 'expected-id', received 'different-id'.")

    expect(api.find).not.toHaveBeenCalled()
    expect(api.update).not.toHaveBeenCalled()
  })

  it('propagates Local API find errors', async () => {
    const findError = new Error('Pages query failed')
    const api = mockRequest({ findError })

    await expect(
      refreshPagesUsingTemplate({
        templateID: 'template-1',
        req: api.req,
      }),
    ).rejects.toBe(findError)
  })

  it('propagates Local API findByID errors', async () => {
    const page = makePage('page-template-error', [
      reusableBlock('template-1', true),
      reusableBlock('template-other', true),
    ])
    const findByIDError = new Error('Template read failed')
    const api = mockRequest({ pages: [page], findByIDError })

    await expect(
      refreshPagesUsingTemplate({
        templateID: 'template-1',
        template: makeTemplate('template-1', 'Title', 'Body'),
        req: api.req,
      }),
    ).rejects.toBe(findByIDError)

    expect(api.update).not.toHaveBeenCalled()
  })

  it('updates matching Search records without creating duplicates', async () => {
    const page = makePage('page-duplicate-search', [
      reusableBlock('template-1', true),
    ])
    const existingSearchDocs = [{ id: 'search-1' }, { id: 'search-2' }]
    const api = mockRequest({ pages: [page], searchDocs: existingSearchDocs })

    await refreshPagesUsingTemplate({
      templateID: 'template-1',
      template: makeTemplate('template-1', 'Title', 'Body'),
      req: api.req,
    })

    expect(api.update).toHaveBeenCalledOnce()
    expect(api.update.mock.calls[0][0]).toMatchObject({
      collection: 'search',
      where: {
        and: [
          { 'doc.relationTo': { equals: 'pages' } },
          { 'doc.value': { equals: 'page-duplicate-search' } },
        ],
      },
    } satisfies Partial<MockUpdateOptions>)
    await expect(api.update.mock.results[0].value).resolves.toMatchObject({
      docs: existingSearchDocs,
    })
    expect(api.create).not.toHaveBeenCalled()
  })
})
