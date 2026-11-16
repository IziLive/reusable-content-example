/**
 * Processes media resource URL to ensure proper formatting
 * @param url The original URL from the resource
 * @param cacheTag Optional cache tag to append to the URL
 * @returns Properly formatted URL with cache tag if provided
 */
export const getMediaUrl = (url: string | null | undefined, cacheTag?: string | null): string => {
  if (!url) return ''

  const separator = url.includes('?') ? '&' : '?'
  const cacheParam = cacheTag ? `${separator}${encodeURIComponent(cacheTag)}` : ''

  return `${url}${cacheParam}`
}
