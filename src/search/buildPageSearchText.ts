import type { ContentBlock, Page, ReusableContentBlock, Template } from '@/payload-types'
import { extractLexicalText } from '@/search/extractLexicalText'
import { normalizeSearchText } from '@/search/normalize'

function getContentBlocksText(blocks: ContentBlock[] | null | undefined): string[] {
  if (!blocks) {
    return []
  }

  return blocks.flatMap((block) => {
    const text = extractLexicalText(block.richText)
    return text ? [text] : []
  })
}

function getReusableContentText(
  block: ReusableContentBlock,
  templatesByID?: ReadonlyMap<string, Template>,
): string[] {
  if (!block.useTemplateValues) {
    return getContentBlocksText(block.content)
  }

  const template =
    typeof block.template === 'object'
      ? block.template
      : templatesByID?.get(block.template)

  if (!template) {
    return []
  }

  return getContentBlocksText(template.content)
}

export function buildPageSearchText(
  page: Page,
  templatesByID?: ReadonlyMap<string, Template>,
): string {
  const parts: string[] = [page.title]

  if (page.hero.type !== 'none') {
    const heroText = extractLexicalText(page.hero.richText)
    if (heroText) {
      parts.push(heroText)
    }

    if (page.hero.type === 'highImpact' || page.hero.type === 'mediumImpact') {
      for (const { link } of page.hero.links ?? []) {
        parts.push(link.label)
      }
    }

    if (
      page.hero.type === 'mediumImpact' &&
      typeof page.hero.media === 'object' &&
      page.hero.media
    ) {
      const caption = extractLexicalText(page.hero.media.caption)
      if (caption) {
        parts.push(caption)
      }
    }
  }

  for (const block of page.layout) {
    switch (block.blockType) {
      case 'content': {
        const text = extractLexicalText(block.richText)
        if (text) {
          parts.push(text)
        }
        break
      }
      case 'formBlock': {
        if (block.enableIntro) {
          const text = extractLexicalText(block.introContent)
          if (text) {
            parts.push(text)
          }
        }
        break
      }
      case 'reusableContent':
        parts.push(...getReusableContentText(block, templatesByID))
        break
    }
  }

  parts.push(page.meta?.title ?? '', page.meta?.description ?? '')

  const uniqueParts = new Set(
    parts.map((part) => normalizeSearchText(part)).filter(Boolean),
  )

  return [...uniqueParts].join(' ')
}
