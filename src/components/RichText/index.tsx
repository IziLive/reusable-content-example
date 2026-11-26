import { DefaultNodeTypes, SerializedLinkNode, SerializedBlockNode } from '@payloadcms/richtext-lexical'
import {
  JSXConvertersFunction,
  LinkJSXConverter,
  RichText as ConvertRichText,
} from '@payloadcms/richtext-lexical/react'
import type { SerializedUploadNode } from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from 'lexical'

import LightboxImage from '@/components/LightboxImage'
import { cn } from '@/utilities/ui'

type NodeTypes = DefaultNodeTypes | SerializedBlockNode<any>

const internalDocToHref = ({ linkNode }: { linkNode: SerializedLinkNode }) => {
  const { value } = linkNode.fields.doc!
  if (typeof value !== 'object') {
    throw new Error('Expected value to be an object')
  }
  const slug = value.slug
  return `/${slug}`
}

const jsxConverters: JSXConvertersFunction<NodeTypes> = ({ defaultConverters }) => ({
  ...defaultConverters,
  ...LinkJSXConverter({ internalDocToHref }),
  blocks: {
    infoCallout: ({ node }: { node: any }) => {
      const style = (['info', 'warning', 'error', 'success'] as const).find(
        (value) => value === node.fields.style,
      ) ?? 'info'
      const content = typeof node.fields.content === 'string' ? node.fields.content : ''
      const icons = {
        info: 'ℹ',
        warning: '⚠',
        error: '✕',
        success: '✓',
      }
      const title = typeof node.fields.title === 'string' ? node.fields.title.trim() : ''

      return (
        <aside className={`payload-callout payload-callout--${style}`} role="note">
          <span className="payload-callout__icon" aria-hidden="true">{icons[style]}</span>
          <div className="payload-callout__body">
            {title && <strong className="payload-callout__title">{title}</strong>}
            <div className="payload-callout__content">{content}</div>
          </div>
        </aside>
      )
    },
  },
  upload: ({ node }) => {
    const uploadNode = node as SerializedUploadNode

    if (!uploadNode.value || typeof uploadNode.value !== 'object') {
      return null
    }

    const media = uploadNode.value
    const alt =
      typeof uploadNode.fields?.alt === 'string'
        ? uploadNode.fields.alt
        : typeof media.alt === 'string'
          ? media.alt
          : ''

    if (!media.mimeType?.startsWith('image/') || !media.url) {
      return media.url ? (
        <a href={media.url} rel="noopener noreferrer">
          {media.filename || 'Скачать файл'}
        </a>
      ) : null
    }

    const captionData = uploadNode.fields?.caption
    const caption =
      typeof captionData === 'string'
        ? captionData
        : captionData &&
            typeof captionData === 'object' &&
            'root' in captionData
          ? (
              <ConvertRichText
                data={captionData as SerializedEditorState}
                converters={jsxConverters}
              />
            )
          : null

    const imageWidth = media.width || undefined
    const imageHeight = media.height || undefined

    return (
      <LightboxImage
        src={media.url}
        alt={alt}
        width={imageWidth}
        height={imageHeight}
        align={uploadNode.format}
        caption={caption}
      />
    )
  },
})

type Props = {
  data: SerializedEditorState
  enableGutter?: boolean
  enableProse?: boolean
} & React.HTMLAttributes<HTMLDivElement>

export default function RichText(props: Props) {
  const { className, enableProse = true, enableGutter = true, ...rest } = props
  return (
    <ConvertRichText
      converters={jsxConverters}
      className={cn(
        'payload-richtext',
        {
          container: enableGutter,
          'max-w-none': !enableGutter,
          'mx-auto prose md:prose-md dark:prose-invert': enableProse,
        },
        className,
      )}
      {...rest}
    />
  )
}
