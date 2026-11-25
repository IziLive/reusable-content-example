import type { Block } from 'payload'

import {
  AlignFeature,
  BlocksFeature,
  TableFeature,
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  UploadFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

const InfoCallout: Block = {
  slug: 'infoCallout',
  labels: {
    singular: 'Информационный блок',
    plural: 'Информационные блоки',
  },
  fields: [
    {
      name: 'style',
      type: 'select',
      label: 'Тип сообщения',
      defaultValue: 'info',
      required: true,
      options: [
        { label: 'Информация', value: 'info' },
        { label: 'Предупреждение', value: 'warning' },
        { label: 'Ошибка / опасность', value: 'error' },
        { label: 'Успешно', value: 'success' },
      ],
    },
    {
      name: 'content',
      type: 'textarea',
      label: 'Текст сообщения',
      required: true,
      admin: {
        rows: 4,
      },
    },
  ],
}

export const Content: Block = {
  slug: 'content',
  interfaceName: 'ContentBlock',
  fields: [
    {
      name: 'richText',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ defaultFeatures, rootFeatures }) => {
          return [
            ...defaultFeatures,
            ...rootFeatures,
            AlignFeature(),
            HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
            BlocksFeature({
              blocks: [InfoCallout],
            }),
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
