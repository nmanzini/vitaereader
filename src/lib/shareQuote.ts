/**
 * Tasteful short citation + deep-link URL for share intents.
 */

const PRODUCTION_ORIGIN = 'https://nmanzini.github.io'
const MAX_QUOTE = 180

export function truncateQuote(text: string, max = MAX_QUOTE): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  const cut = cleaned.slice(0, max - 1)
  const sp = cut.lastIndexOf(' ')
  const base = sp > max * 0.5 ? cut.slice(0, sp) : cut
  return `${base}…`
}

/** App origin+base for share links (prod Pages or current host+Vite base). */
export function readerBaseUrl(
  origin = typeof window !== 'undefined' ? window.location.origin : '',
  base = typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/',
): string {
  const o = origin || PRODUCTION_ORIGIN
  const b = base.endsWith('/') ? base : `${base}/`
  return `${o}${b}`
}

/** Deep link to a work, optionally anchored on a paragraph. */
export function workShareUrl(
  workSlug: string,
  paraId?: string,
  origin?: string,
  base?: string,
): string {
  const root = readerBaseUrl(origin, base).replace(/\/?$/, '/')
  const path = `read/${encodeURIComponent(workSlug)}`
  const qs = paraId ? `?p=${encodeURIComponent(paraId)}` : ''
  return `${root}${path}${qs}`
}

/** Tweet/X status body: title + short quote + URL (keep under ~280). */
export function buildShareText(
  workTitle: string,
  quote: string,
  url: string,
): string {
  const q = truncateQuote(quote, MAX_QUOTE)
  const cited = q ? `“${q}”` : ''
  const parts = [workTitle, cited, url].filter(Boolean)
  let text = parts.join('\n')
  if (text.length <= 270) return text
  const shorter = truncateQuote(quote, Math.max(40, MAX_QUOTE - (text.length - 270)))
  return [workTitle, shorter ? `“${shorter}”` : '', url].filter(Boolean).join('\n')
}

export function twitterIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
}
