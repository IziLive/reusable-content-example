import type { Block, Field } from 'payload'

import {
  AlignFeature,
  TableFeature,
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  UploadFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

export const Content: Block = {
  slug: 'content',
  interfaceName: 'ContentBlock',
  fields: [
    {
      name: 'richText',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            AlignFeature(),
            HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
            FixedToolbarFeature(),
            InlineToolbarFeature(),
            TableFeature(),
            UploadFeature({
              enabledCollections: ['media'],
              collections: {
                media: {
                  fields: [
                    {
                      name: 'alt',
                      type: 'text',
                    },
                    {
                      name: 'caption',
                      type: 'text',
                    },
                  ],
                },
              },
            }),
          ]
        },
      }),
      label: false,
    },
  ],
}
