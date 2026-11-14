import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  Payload,
} from 'payload'

import { revalidateTag } from 'next/cache'

function invalidateRedirectsCache(payload: Payload) {
  payload.logger.info(`Revalidating redirects`)
  revalidateTag('redirects', 'max')
}

export const revalidateRedirects: CollectionAfterChangeHook = ({ doc, req: { payload } }) => {
  invalidateRedirectsCache(payload)

  return doc
}

export const revalidateRedirectsAfterDelete: CollectionAfterDeleteHook = ({
  doc,
  req: { payload },
}) => {
  invalidateRedirectsCache(payload)

  return doc
}
