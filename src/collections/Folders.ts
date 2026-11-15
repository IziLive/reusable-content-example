import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

export const Folders: CollectionConfig = {
  slug: 'folders',
  folders: true,
  admin: {
    useAsTitle: 'name',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
