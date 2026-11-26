import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import { Media } from '@/components/Media'

type Args = {
  params: Promise<{
    slug: string
  }>
}

export default async function CategoryPage({ params }: Args) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })

  const categoryResult = await payload.find({
    collection: 'categories',
    limit: 1,
    depth: 0,
    overrideAccess: false,
    where: {
      slug: {
        equals: decodeURIComponent(slug),
      },
    },
  })

  const category = categoryResult.docs[0]

  if (!category) {
    notFound()
  }

  const pagesResult = await payload.find({
    collection: 'pages',
    draft: false,
    limit: 100,
    pagination: false,
    depth: 1,
    overrideAccess: false,
    sort: '-publishedAt',
    where: {
      and: [
        {
          _status: {
            equals: 'published',
          },
        },
        {
          'listing.categories': {
            contains: category.id,
          },
        },
      ],
    },
  })

  const pages = pagesResult.docs

  return (
    <main className="container py-16">
      <header className="mb-12 max-w-3xl">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">{category.title}</h1>
        {category.description && (
          <p className="text-lg text-muted-foreground">{category.description}</p>
        )}
      </header>

      {pages.length > 0 ? (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <article key={page.id} className="overflow-hidden rounded-lg border bg-card">
              <Link href={`/${page.slug}`} className="group block">
                {page.listing?.cardImage && (
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <Media
                      resource={page.listing.cardImage}
                      fill
                      imgClassName="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-5">
                  {page.publishedAt && (
                    <time
                      className="mb-2 block text-sm text-muted-foreground"
                      dateTime={page.publishedAt}
                    >
                      {new Intl.DateTimeFormat('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }).format(new Date(page.publishedAt))}
                    </time>
                  )}
                  <h2 className="mb-2 text-xl font-semibold">{page.title}</h2>
                  {page.listing?.excerpt && (
                    <p className="text-sm text-muted-foreground">{page.listing.excerpt}</p>
                  )}
                </div>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">В этой категории пока нет опубликованных материалов.</p>
      )}
    </main>
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'categories',
    limit: 1,
    depth: 0,
    overrideAccess: false,
    where: {
      slug: {
        equals: decodeURIComponent(slug),
      },
    },
  })

  const category = result.docs[0]

  if (!category) {
    return {
      title: 'Категория не найдена',
    }
  }

  return {
    title: category.title,
    description: category.description || undefined,
  }
}
