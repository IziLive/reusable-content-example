import type { Block, CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { Content } from '@/blocks/Content/config'
import type { Template } from '@/payload-types'
import { refreshPagesUsingTemplate } from '@/search/refreshPagesUsingTemplate'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

// We need to make sure our ReusableContent block can use the exact same blocks as our Templates collection
export const TemplatesBlocks: Block[] = [Content]

const refreshPagesAfterTemplateChange: CollectionAfterChangeHook<Template> = async ({
  doc,
  req,
}) => {
  await refreshPagesUsingTemplate({
    templateID: doc.id,
    template: doc,
    req,
  })

  return doc
}

const refreshPagesAfterTemplateDelete: CollectionAfterDeleteHook<Template> = async ({
  doc,
  id,
  req,
}) => {
  await refreshPagesUsingTemplate({
    templateID: String(id ?? doc.id),
    req,
  })

  return doc
}

export const Templates: CollectionConfig = {
  slug: 'templates',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'blocks',
      blocks: TemplatesBlocks,
    },
  ],
  hooks: {
    afterChange: [refreshPagesAfterTemplateChange],
    afterDelete: [refreshPagesAfterTemplateDelete],
  },
}
