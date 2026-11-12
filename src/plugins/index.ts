import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import { Plugin } from 'payload'
import { authenticated } from '@/access/authenticated'
import {
  revalidateRedirects,
  revalidateRedirectsAfterDelete,
} from '@/hooks/revalidateRedirects'
import { enforceFormEmailRecipient } from '@/hooks/enforceFormEmailRecipient'
import { rateLimitFormSubmissionBeforeChange } from '@/hooks/rateLimitFormSubmission'
import { validateFormSubmissionBeforeChange } from '@/hooks/validateFormSubmission'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { searchFields } from '@/search/fieldOverrides'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { buildPageSearchText } from '@/search/buildPageSearchText'

import type { Page, Template } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

const generateTitle: GenerateTitle<Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | Payload Website Template` : 'Payload Website Template'
}

const generateURL: GenerateURL<Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

export const plugins: Plugin[] = [
  redirectsPlugin({
    collections: ['pages'],
    overrides: {
      hooks: {
        afterChange: [revalidateRedirects],
        afterDelete: [revalidateRedirectsAfterDelete],
      },
    },
  }),
  nestedDocsPlugin({
    collections: ['categories'],
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
  }),
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  searchPlugin({
    collections: ['pages'],
    syncDrafts: false,
    deleteDrafts: true,
    beforeSync: async (args) => {
      if (args.searchDoc.doc.relationTo !== 'pages') {
        return args.searchDoc
      }

      const page = args.originalDoc as Page
      const templatesByID = new Map<string, Template>()

      for (const block of page.layout) {
        if (
          block.blockType !== 'reusableContent' ||
          !block.useTemplateValues ||
          typeof block.template !== 'string' ||
          templatesByID.has(block.template)
        ) {
          continue
        }

        const template = await args.req.payload.findByID({
          collection: 'templates',
          id: block.template,
          depth: 0,
          disableErrors: true,
          overrideAccess: false,
          req: args.req,
        })

        if (template) {
          templatesByID.set(block.template, template)
        }
      }

      const searchDoc = await beforeSyncWithSearch(args)

      return {
        ...searchDoc,
        searchableText: buildPageSearchText(page, templatesByID),
      }
    },
    searchOverrides: {
      access: {
        read: authenticated,
      },
      fields: ({ defaultFields }) => [...defaultFields, ...searchFields],
    },
  }),
  formBuilderPlugin({
    defaultToEmail: process.env.FORM_BUILDER_DEFAULT_TO_EMAIL,
    beforeEmail: (emails) =>
      enforceFormEmailRecipient(emails, process.env.FORM_BUILDER_DEFAULT_TO_EMAIL),
    fields: {
      payment: false,
    },
    formOverrides: {
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
    formSubmissionOverrides: {
      hooks: {
        beforeChange: [rateLimitFormSubmissionBeforeChange, validateFormSubmissionBeforeChange],
      },
    },
  }),
]
