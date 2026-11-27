'use client'

import React, { useEffect, useState } from 'react'
import { ChevronDown, Menu, SearchIcon, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { Header as HeaderType, NavigationMenu } from '@/payload-types'
import { CMSLink } from '@/components/Link'

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
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [desktopSubmenusDismissed, setDesktopSubmenusDismissed] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
    setExpandedItems([])
    setDesktopSubmenusDismissed(true)
  }, [pathname])

  const toggleExpanded = (key: string) => {
    setExpandedItems((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    )
  }

  return (
    <div className="relative flex items-center lg:min-w-0 lg:flex-1 lg:items-end">
      {/* Full navigation for desktop */}
      <nav aria-label="Main navigation" className="hidden w-full items-end justify-between lg:flex">
        <div className="flex items-center gap-6">
        {menuItems.length > 0
          ? menuItems.map((item, i) => {
              const href = getMenuItemHref(item)
              const children = item.children || []
              const key = item.id || `${item.label}-${i}`

              return (
                <div
                  key={key}
                  className="group relative"
                  onMouseEnter={() => setDesktopSubmenusDismissed(false)}
                >
                  {href ? (
                    <Link href={href} className="text-primary hover:underline" onClick={() => setDesktopSubmenusDismissed(true)}>
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-primary">{item.label}</span>
                  )}

                  {children.length > 0 && (
                    <div className={`site-header__submenu absolute left-0 top-full z-50 max-w-[calc(100vw_-_2rem)] flex-col ${desktopSubmenusDismissed ? 'hidden' : 'hidden group-hover:flex group-focus-within:flex'}`}>
                      {children.map((child, childIndex) => {
                        const childHref = getMenuItemHref(child)

                        return childHref ? (
                          <Link
                            key={child.id || `${child.label}-${childIndex}`}
                            href={childHref}
                            className="site-header__submenu-link text-primary hover:underline"
                          >
                            {child.label}
                          </Link>
                        ) : (
                          <span
                            key={child.id || `${child.label}-${childIndex}`}
                            className="site-header__submenu-link text-primary"
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
          : navItems.map(({ link }, i) => <CMSLink key={i} {...link} appearance="link" />)}
        </div>
        <Link href="/search" aria-label="Search">
          <SearchIcon className="w-5 text-primary" />
        </Link>
      </nav>

      {/* Compact navigation for mobile and tablet */}
      <button
        type="button"
        className="inline-flex items-center justify-center rounded p-2 text-primary hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 lg:hidden"
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
        aria-controls="header-mobile-navigation"
        onClick={() => setMobileOpen((open) => !open)}
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {mobileOpen && (
        <nav
          id="header-mobile-navigation"
          aria-label="Mobile navigation"
          className="absolute right-0 top-[calc(100%_+_2rem)] z-50 max-h-[calc(100dvh_-_7rem)] w-[min(22rem,calc(100vw_-_2rem))] overflow-y-auto rounded-md border border-border bg-background p-3 shadow-xl lg:hidden"
        >
          <div className="flex flex-col">
            {menuItems.length > 0
              ? menuItems.map((item, i) => {
                  const key = item.id || `${item.label}-${i}`
                  const href = getMenuItemHref(item)
                  const children = item.children || []
                  const expanded = expandedItems.includes(key)

                  return (
                    <div key={key} className="border-b border-border last:border-b-0">
                      <div className="flex items-center gap-2">
                        {href ? (
                          <Link
                            href={href}
                            className="min-w-0 flex-1 px-3 py-3 text-primary"
                          >
                            {item.label}
                          </Link>
                        ) : (
                          <span className="min-w-0 flex-1 px-3 py-3 text-primary">
                            {item.label}
                          </span>
                        )}
                        {children.length > 0 && (
                          <button
                            type="button"
                            className="rounded p-3 text-primary hover:bg-muted"
                            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
                            aria-expanded={expanded}
                            onClick={() => toggleExpanded(key)}
                          >
                            <ChevronDown
                              size={18}
                              className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
                            />
                          </button>
                        )}
                      </div>
                      {children.length > 0 && expanded && (
                        <div className="flex flex-col pb-2">
                          {children.map((child, childIndex) => {
                            const childHref = getMenuItemHref(child)

                            return childHref ? (
                              <Link
                                key={child.id || `${child.label}-${childIndex}`}
                                href={childHref}
                                className="rounded px-3 py-2 text-sm text-primary hover:bg-muted"
                              >
                                {child.label}
                              </Link>
                            ) : (
                              <span
                                key={child.id || `${child.label}-${childIndex}`}
                                className="px-3 py-2 text-sm text-primary"
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
              : navItems.map(({ link }, i) => (
                  <div key={i} className="border-b border-border py-2 last:border-b-0">
                    <CMSLink {...link} appearance="link" />
                  </div>
                ))}
            <Link
              href="/search"
              className="flex items-center gap-2 px-3 py-3 text-primary hover:bg-muted"
            >
              <SearchIcon size={18} />
              Search
            </Link>
          </div>
        </nav>
      )}
    </div>
  )
}
