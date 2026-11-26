'use client'

import React from 'react'

import type { Header as HeaderType, NavigationMenu } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import Link from 'next/link'
import { SearchIcon } from 'lucide-react'

type MenuItem = NonNullable<NavigationMenu['items']>[number]

const getMenuItemHref = (item: MenuItem): string | null => {
  if (item.linkType === 'custom') {
    return item.url || null
  }

  if (item.linkType !== 'reference' || !item.reference) {
    return null
  }

  const { relationTo, value } = item.reference

  if (typeof value !== 'object' || value === null) {
    return null
  }

  return relationTo === 'categories' ? `/category/${value.slug}` : `/${value.slug}`
}

export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
  const menu = typeof data.menu === 'object' && data.menu ? data.menu : null
  const menuItems = menu?.items || []
  const navItems = data?.navItems || []

  return (
    <nav className="flex gap-3 items-center">
      {menuItems.length > 0
        ? menuItems.map((item, i) => {
            const href = getMenuItemHref(item)
            const children = item.children || []

            return (
              <div key={item.id || `${item.label}-${i}`} className="group relative">
                {href ? (
                  <Link href={href} className="text-primary hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-primary">{item.label}</span>
                )}

                {children.length > 0 && (
                  <div className="absolute left-0 top-full z-50 hidden min-w-48 flex-col rounded-md bg-background p-2 shadow-lg group-hover:flex group-focus-within:flex">
                    {children.map((child, childIndex) => {
                      const childHref = getMenuItemHref(child)

                      return childHref ? (
                        <Link
                          key={child.id || `${child.label}-${childIndex}`}
                          href={childHref}
                          className="whitespace-nowrap rounded px-3 py-2 text-primary hover:bg-muted"
                        >
                          {child.label}
                        </Link>
                      ) : (
                        <span
                          key={child.id || `${child.label}-${childIndex}`}
                          className="whitespace-nowrap px-3 py-2 text-primary"
                        >
                          {child.label}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        : navItems.map(({ link }, i) => {
            return <CMSLink key={i} {...link} appearance="link" />
          })}
      <Link href="/search">
        <span className="sr-only">Search</span>
        <SearchIcon className="w-5 text-primary" />
      </Link>
    </nav>
  )
}
