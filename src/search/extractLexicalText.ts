import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'

import type { ContentBlock, FormBlock, Media, Page } from '@/payload-types'

type LexicalRichText =
  | Page['hero']['richText']
  | ContentBlock['richText']
  | FormBlock['introContent']
  | Media['caption']

export function extractLexicalText(value: LexicalRichText): string {
  if (!value?.root?.children?.length) {
    return ''
  }

  return convertLexicalToPlaintext({ data: value })
}
