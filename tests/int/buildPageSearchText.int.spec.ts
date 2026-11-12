import { describe, expect, it } from 'vitest'
import type { Page } from '@/payload-types'
import { buildPageSearchText } from '@/search/buildPageSearchText'

function richText(text: string): NonNullable<Page['hero']['richText']> {
  return {
    root: {
      type: 'root',
      version: 1,
      direction: null,
      format: '' as const,
      indent: 0,
      children: [
        {
          type: 'paragraph',
          version: 1,
          direction: null,
          format: '' as const,
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

function page(overrides: Partial<Page['hero']> = {}): Page {
  return {
    id: 'page-1',
    title: 'Page title',
    hero: {
      type: 'mediumImpact',
      richText: richText('Hero copy'),
      links: [{ link: { label: 'Call to action' } }],
      ...overrides,
    },
    layout: [{ blockType: 'content', richText: richText('Page content') }],
    meta: {
      title: 'SEO title',
      description: 'SEO description',
    },
    slug: 'page-1',
    updatedAt: '',
    createdAt: '',
  } as Page
}

describe('buildPageSearchText', () => {
  it('indexes a Medium Hero media caption without changing other indexed fields', () => {
    const pageWithoutCaption = page()
    const pageWithCaption = page({
      media: {
        id: 'media-1',
        caption: richText('VISIBLE Caption'),
        updatedAt: '',
        createdAt: '',
      },
    })

    const baseline = buildPageSearchText(pageWithoutCaption)
    const indexed = buildPageSearchText(pageWithCaption)

    expect(indexed.replace(' visible caption', '')).toBe(baseline)
    expect(indexed).toContain('page title')
    expect(indexed).toContain('hero copy')
    expect(indexed).toContain('call to action')
    expect(indexed).toContain('page content')
    expect(indexed).toContain('seo title')
    expect(indexed).toContain('seo description')
  })

  it('does not add text for an empty caption', () => {
    const baseline = buildPageSearchText(page())

    expect(
      buildPageSearchText(
        page({
          media: {
            id: 'media-1',
            caption: richText('   '),
            updatedAt: '',
            createdAt: '',
          },
        }),
      ),
    ).toBe(baseline)
  })

  it.each([
    ['missing media', undefined],
    ['unpopulated media relationship', 'media-1'],
    ['missing caption', { id: 'media-1' }],
    ['null caption', { id: 'media-1', caption: null }],
  ])('does not throw or add text for %s', (_description, media) => {
    const baseline = buildPageSearchText(page())

    expect(() =>
      buildPageSearchText(page({ media } as Page['hero'])),
    ).not.toThrow()
    expect(buildPageSearchText(page({ media } as Page['hero']))).toBe(baseline)
  })
})
