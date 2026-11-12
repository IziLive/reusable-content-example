import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MAX_SEARCH_PAGE, searchPages } from '@/search/searchPages'
import { redirect } from 'next/navigation'

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[]
    page?: string | string[]
  }>
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

function parsePageNumber(value: string): number {
  if (!/^\d+$/.test(value)) {
    return 1
  }

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}

function pageHref(query: string, pageNumber: number): string {
  const params = new URLSearchParams({ q: query, page: String(pageNumber) })
  return `/search?${params.toString()}`
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const inputQuery = firstParam(params.q)
  const pageNumber = parsePageNumber(firstParam(params.page))

  if (pageNumber > MAX_SEARCH_PAGE) {
    const redirectParams = new URLSearchParams({ q: inputQuery })
    redirect(`/search?${redirectParams.toString()}`)
  }

  const { results, hasNextPage, query } = await searchPages(inputQuery, pageNumber)
  const hasQuery = query.length > 0
  const isTooShort = hasQuery && query.length < 2

  return (
    <main className="container flex-1 py-12 md:py-16">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Поиск</h1>
          <p className="text-muted-foreground">
            Найдите опубликованные страницы сайта.
          </p>
        </header>

        <form action="/search" method="get" className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 space-y-2">
            <Label htmlFor="search-query">Поисковый запрос</Label>
            <Input
              id="search-query"
              name="q"
              type="search"
              defaultValue={inputQuery}
              placeholder="Введите запрос"
              autoComplete="off"
            />
          </div>
          <Button type="submit" className="sm:mt-7">
            Найти
          </Button>
        </form>

        {!hasQuery ? (
          <p className="text-muted-foreground">
            Введите запрос длиной не менее двух символов.
          </p>
        ) : isTooShort ? (
          <p className="text-muted-foreground">
            Запрос слишком короткий. Введите не менее двух символов.
          </p>
        ) : results.length === 0 ? (
          <p className="text-muted-foreground">
            По запросу «{query}» ничего не найдено.
          </p>
        ) : (
          <section aria-live="polite" aria-label="Результаты поиска" className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Результаты для «{query}» — показано: {results.length}
            </p>

            <ul className="space-y-4">
              {results.map((result) => (
                <li key={result.id}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">
                        <Link
                          className="underline underline-offset-4 hover:text-primary"
                          href={result.url}
                        >
                          {result.title}
                        </Link>
                      </CardTitle>
                    </CardHeader>
                    {result.description && (
                      <CardContent>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {result.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </li>
              ))}
            </ul>

            {(pageNumber > 1 || hasNextPage) && (
              <nav
                aria-label="Страницы результатов поиска"
                className="flex items-center justify-between gap-4"
              >
                {pageNumber > 1 ? (
                  <Button asChild variant="outline">
                    <Link href={pageHref(inputQuery, pageNumber - 1)}>Предыдущая</Link>
                  </Button>
                ) : (
                  <span />
                )}
                {hasNextPage && pageNumber < MAX_SEARCH_PAGE && (
                  <Button asChild variant="outline">
                    <Link href={pageHref(inputQuery, pageNumber + 1)}>Следующая</Link>
                  </Button>
                )}
              </nav>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
