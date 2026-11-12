export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}
