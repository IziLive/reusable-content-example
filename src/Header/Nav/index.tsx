'use client'

import React, { useEffect, useRef, useState } from 'react'

import type { Header as HeaderType, NavigationMenu } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import Link from 'next/link'
import { ChevronDown, SearchIcon } from 'lucide-react'

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
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
    }
  }, [])

  const handleMouseEnter = (key: string) => {
    // Touch devices use the explicit disclosure button, never hover emulation.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setOpenMenu(key), 200)
  }

  const handleMouseLeave = () => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    setOpenMenu(null)
  }

  const toggleMenu = (key: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    setOpenMenu((current) => (current === key ? null : key))
  }

  return (
    <nav className="flex flex-col items-end gap-2 md:flex-row md:items-center md:gap-3">
      {menuItems.length > 0
        ? menuItems.map((item, i) => {
            const key = item.id || `${item.label}-${i}`
            const href = getMenuItemHref(item)
            const children = item.children || []

            return (
              <div
                key={key}
                className="relative w-full md:w-auto"
                onMouseEnter={() => handleMouseEnter(key)}
                onMouseLeave={handleMouseLeave}
              >
                <div className="flex items-center justify-end gap-1">
                  {href ? (
                    <Link href={href} className="text-primary hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-primary">{item.label}</span>
                  )}

                  {children.length > 0 && (
                    <button
                      type="button"
                      className="rounded p-1 text-primary md:hidden"
                      aria-label={`Открыть подменю: ${item.label}`}
                      aria-expanded={openMenu === key}
                      aria-controls={`header-submenu-${i}`}
                      onClick={() => toggleMenu(key)}
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${openMenu === key ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}
                </div>

                {children.length > 0 && (
                  <div
                    id={`header-submenu-${i}`}
                    className={`mt-2 w-full min-w-0 flex-col overflow-y-auto rounded-md bg-background p-2 shadow-lg md:absolute md:left-0 md:top-full md:z-50 md:mt-0 md:max-h-[calc(100vh-6rem)] md:w-max md:min-w-48 md:max-w-[min(24rem,calc(100vw-1rem))] ${
                      openMenu === key ? 'flex' : 'hidden'
                    }`}
                  >
                    {children.map((child, childIndex) => {
                      const childHref = getMenuItemHref(child)

                      return childHref ? (
                        <Link
                          key={child.id || `${child.label}-${childIndex}`}
                          href={childHref}
                          className="break-words rounded px-3 py-2 text-primary hover:bg-muted"
                        >
                          {child.label}
                        </Link>
                      ) : (
                        <span
                          key={child.id || `${child.label}-${childIndex}`}
                          className="break-words px-3 py-2 text-primary"
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
