'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

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
  const [submenuLeft, setSubmenuLeft] = useState(0)
  const [submenuMaxWidth, setSubmenuMaxWidth] = useState(0)
  const activeParentRef = useRef<HTMLDivElement | null>(null)
  const submenuRef = useRef<HTMLDivElement | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
    }
  }, [])

  const handleMouseEnter = (key: string, event: React.MouseEvent<HTMLDivElement>) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    activeParentRef.current = event.currentTarget

    hoverTimer.current = setTimeout(() => {
      setOpenMenu(key)
    }, 200)
  }

  useLayoutEffect(() => {
    if (!openMenu) return

    const updateSubmenuPosition = () => {
      const parent = activeParentRef.current
      const submenu = submenuRef.current
      if (!parent || !submenu) return

      const parentRect = parent.getBoundingClientRect()
      // clientWidth excludes the vertical scrollbar and reflects the actual layout viewport.
      const viewportWidth = document.documentElement.clientWidth
      const availableWidth = Math.max(0, viewportWidth - 16)
      const submenuWidth = Math.min(submenu.scrollWidth, availableWidth)
      const rightOverflow = parentRect.left + submenuWidth - (viewportWidth - 8)
      const leftOffset = Math.max(8 - parentRect.left, Math.min(0, -rightOverflow))
      setSubmenuMaxWidth(availableWidth)
      setSubmenuLeft(leftOffset)
    }

    updateSubmenuPosition()
    window.addEventListener('resize', updateSubmenuPosition)

    return () => {
      window.removeEventListener('resize', updateSubmenuPosition)
    }
  }, [openMenu])

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    setOpenMenu(null)
  }

  return (
    <nav className="flex gap-3 items-center">
      {menuItems.length > 0
        ? menuItems.map((item, i) => {
            const key = item.id || `${item.label}-${i}`
            const href = getMenuItemHref(item)
            const children = item.children || []

            return (
              <div
                key={key}
                className="group relative"
                onMouseEnter={(event) => handleMouseEnter(key, event)}
                onMouseLeave={handleMouseLeave}
              >
                <div className="flex items-center gap-1">
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
                      onClick={() => {
                        if (hoverTimer.current) clearTimeout(hoverTimer.current)
                        setOpenMenu((current) => (current === key ? null : key))
                      }}
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
                    ref={openMenu === key ? submenuRef : null}
                    style={{ left: submenuLeft, maxWidth: submenuMaxWidth ? `${submenuMaxWidth}px` : undefined }}
                    className={`absolute top-full z-50 max-h-[calc(100dvh-6rem)] min-w-48 flex-col overflow-x-hidden overflow-y-auto rounded-md bg-background p-2 shadow-lg ${
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
