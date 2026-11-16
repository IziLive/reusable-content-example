'use client'

import { useEffect, useState, type ReactNode } from 'react'

type Props = {
  src: string
  alt: string
  width?: number
  height?: number
  align?: string
  caption?: ReactNode
}

export default function LightboxImage({
  src,
  alt,
  width,
  height,
  align = 'left',
  caption,
}: Props) {
  const [open, setOpen] = useState(false)
  const [zoom, setZoom] = useState(false)

  const alignment = {
    left: 'items-start text-left',
    start: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
    end: 'items-end text-right',
    justify: 'items-center text-justify',
  }[align] || 'items-start text-left'

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setZoom(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <figure className={`my-4 flex flex-col ${alignment}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block max-w-full cursor-zoom-in border-0 bg-transparent p-0"
          aria-label={`Открыть изображение: ${alt || 'без описания'}`}
        >
          <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            className="h-auto max-w-full rounded-md"
            loading="lazy"
          />
        </button>

        {caption && (
          <figcaption className="mt-2 max-w-full text-sm text-gray-600 dark:text-gray-400">
            {caption}
          </figcaption>
        )}
      </figure>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={alt || 'Просмотр изображения'}
          onClick={() => {
            setOpen(false)
            setZoom(false)
          }}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setZoom(false)
            }}
            className="absolute right-4 top-4 z-10 rounded-full bg-black/60 px-4 py-2 text-2xl text-white"
            aria-label="Закрыть"
          >
            ×
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setZoom(!zoom)
            }}
            className="absolute bottom-4 right-4 z-10 rounded-full bg-black/60 px-4 py-2 text-white"
            aria-label={zoom ? 'Уменьшить' : 'Увеличить'}
          >
            {zoom ? '−' : '+'}
          </button>

          <img
            src={src}
            alt={alt}
            onClick={(event) => {
              event.stopPropagation()
              setZoom(!zoom)
            }}
            className={`max-h-[90vh] max-w-[95vw] object-contain transition-transform duration-200 ${
              zoom ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
            }`}
          />
        </div>
      )}
    </>
  )
}
