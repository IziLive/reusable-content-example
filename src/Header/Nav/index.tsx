'use client'

import React, { useEffect, useRef, useState } from 'react'

import type { Header as HeaderType, NavigationMenu } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import Link from 'next/link'
import { MoreHorizontal, SearchIcon, X } from 'lucide-react'

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
  const [activeMenu, setActiveMenu] = useState<{ key: string; label: string; children: MenuItem['children'] } | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!activeMenu) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveMenu(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeMenu])

  return (
    <>
      <nav className="flex items-center gap-3">
        {menuItems.length > 0
          ? menuItems.map((item, i) => {
              const key = item.id || `${item.label}-${i}`
              const href = getMenuItemHref(item)
              const children = item.children || []

              return (
                <div key={key} className="flex items-center gap-1">
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
                      className="rounded p-1 text-primary hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      aria-label={`Открыть подменю: ${item.label}`}
                      aria-haspopup="dialog"
                      aria-expanded={activeMenu?.key === key}
                      onClick={() =>
                        setActiveMenu((current) =>
                          current?.key === key
                            ? null
                            : { key, label: item.label, children: item.children },
                        )
                      }
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
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

      {activeMenu && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveMenu(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="header-submenu-title"
            className="max-h-[min(80dvh,40rem)] w-full max-w-md overflow-y-auto rounded-lg bg-background p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 id="header-submenu-title" className="text-lg font-semibold text-primary">
                {activeMenu.label}
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                className="rounded p-2 text-primary hover:bg-muted"
                aria-label="Закрыть подменю"
                onClick={() => setActiveMenu(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col">
              {(activeMenu.children || []).map((child, childIndex) => {
                const childHref = getMenuItemHref(child)

                return childHref ? (
                  <Link
                    key={child.id || `${child.label}-${childIndex}`}
                    href={childHref}
                    onClick={() => setActiveMenu(null)}
                    className="rounded-md px-3 py-3 text-primary hover:bg-muted"
                  >
                    {child.label}
                  </Link>
                ) : (
                  <span
                    key={child.id || `${child.label}-${childIndex}`}
                    className="px-3 py-3 text-primary"
                  >
                    {child.label}
                  </span>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
