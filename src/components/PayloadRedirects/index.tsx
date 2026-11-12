import type React from 'react'

import { getDocument } from '@/utilities/getDocument'
import { getCachedRedirects } from '@/utilities/getRedirects'
import { notFound, redirect } from 'next/navigation'

interface Props {
  disableNotFound?: boolean
  url: string
}

/* This component helps us with SSR based dynamic redirects */
export const PayloadRedirects: React.FC<Props> = async ({ disableNotFound, url }) => {
  const redirects = await getCachedRedirects()()

  const redirectItem = redirects.find((redirect) => redirect.from === url)

  if (redirectItem) {
    if (redirectItem.to?.url) {
      redirect(redirectItem.to.url)
    }

    const reference = redirectItem.to?.reference
    const referenceValue = reference?.value
    const id =
      typeof referenceValue === 'string' || typeof referenceValue === 'number'
        ? String(referenceValue)
        : referenceValue && typeof referenceValue === 'object'
          ? String(referenceValue.id)
          : null
    const document = reference && id ? await getDocument(reference.relationTo, id) : null
    const redirectUrl = document?.slug ? `/${document.slug}` : ''

    if (redirectUrl) redirect(redirectUrl)
  }

  if (disableNotFound) return null

  notFound()
}
