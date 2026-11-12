
import configPromise from '@payload-config'
import { getPayload } from 'payload'

type Collection = 'pages'

export async function getDocument(collection: Collection, id: string, depth = 0) {
  const payload = await getPayload({ config: configPromise })

  return payload.findByID({
    collection,
    id,
    depth,
    disableErrors: true,
    overrideAccess: false,
  })
}