import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

const menuItemFields = [
  {
    name: 'label',
    type: 'text' as const,
    required: true,
  },
  {
    name: 'linkType',
    type: 'radio' as const,
    defaultValue: 'none',
    options: [
      { label: 'No link (parent item)', value: 'none' },
      { label: 'Page or category', value: 'reference' },
      { label: 'Custom URL', value: 'custom' },
    ],
    admin: {
      layout: 'horizontal' as const,
    },
  },
  {
    name: 'reference',
    type: 'relationship' as const,
    relationTo: ['pages', 'categories'] as const,
    admin: {
      condition: (_: unknown, siblingData: { linkType?: string }) => siblingData?.linkType === 'reference',
    },
    required: true,
  },
  {
    name: 'url',
    type: 'text' as const,
    admin: {
      condition: (_: unknown, siblingData: { linkType?: string }) => siblingData?.linkType === 'custom',
    },
    required: true,
  },
]

export const NavigationMenus: CollectionConfig = {
  slug: 'navigation-menus',
  access: {
    create: authenticated,
    delete: authenticated,
    read: () => true,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt'],
    description: 'Menus used by the site header and footer.',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'items',
      type: 'array',
      labels: {
        singular: 'Menu item',
        plural: 'Menu items',
      },
      admin: {
        initCollapsed: true,
      },
      fields: [
        ...menuItemFields,
        {
          name: 'children',
          type: 'array',
          labels: {
            singular: 'Submenu item',
            plural: 'Submenu items',
          },
          admin: {
            initCollapsed: true,
            description: 'Optional second-level items.',
          },
          fields: menuItemFields,
        },
      ],
    },
  ],
}
