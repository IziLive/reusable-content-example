import type { Media } from '@/payload-types'

export const image3: Omit<Media, 'createdAt' | 'id' | 'updatedAt'> = {
  alt: 'Straight metallic shapes with an orange and blue gradient',
  caption: 'Photo by Andrew Kliatskyi on Unsplash.',
}
