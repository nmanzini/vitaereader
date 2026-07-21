/** Pure text helpers for EPUB ingest — kept small and testable. */

export function slugify(title) {
  return title
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/comparision/g, 'comparison')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim()
}

export function wordCount(text) {
  const m = text.match(/[A-Za-z0-9’'-]+/g)
  return m ? m.length : 0
}

/** Title-case ALL-CAPS chapter headings for the UI. */
export function displayTitle(title) {
  if (title !== title.toUpperCase() || !/[A-Z]/.test(title)) return title

  const fixed = title
    .replace(/COMPARISION/i, 'COMPARISON')
    .replace(/\.$/, '')

  return fixed
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bOf\b/g, 'of')
    .replace(/\bWith\b/g, 'with')
    .replace(/\bAnd\b/g, 'and')
    .replace(/\bThe\b/g, 'the')
}

export function classifyWork(title, slug) {
  if (
    title.toUpperCase().startsWith('COMPARISON') ||
    slug.startsWith('comparison-')
  ) {
    return 'comparison'
  }
  return 'life'
}
