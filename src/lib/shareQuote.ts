/**
 * Tasteful short citation + deep-link URL for share intents.
 * Quote-card PNG rendering: `quoteCard.ts` (loaded on share via dynamic import).
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

export type ShareQuoteResult =
  | 'shared'
  | 'downloaded'
  | 'cancelled'
  | 'failed'

function downloadPng(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(href), 2_000)
}

function canShareFiles(file: File): boolean {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
  }
  if (typeof nav.share !== 'function') return false
  if (typeof nav.canShare !== 'function') return true
  try {
    return nav.canShare({ files: [file] })
  } catch {
    return false
  }
}

/**
 * Share selection: generate a quote-card PNG, then
 * 1) `navigator.share` with file + text + deep-link when the OS allows files
 * 2) else download the PNG and open X web intent (text+URL only — no image attach)
 */
export async function shareSelectionQuote(opts: {
  quote: string
  workTitle: string
  workId: string
  paraId?: string
}): Promise<ShareQuoteResult> {
  const home = readerBaseUrl()
  const deepLink = workShareUrl(opts.workId, opts.paraId)
  const text = buildShareText(opts.workTitle, opts.quote, deepLink)

  // Dynamic import keeps Node unit tests free of canvas module resolution.
  const { quoteCardFileName, renderQuoteCardPng } = await import('./quoteCard')
  const filename = quoteCardFileName(opts.workTitle)

  let blob: Blob
  try {
    blob = await renderQuoteCardPng({
      quote: opts.quote,
      workTitle: opts.workTitle,
      siteUrl: home,
    })
  } catch {
    window.open(twitterIntentUrl(text), '_blank', 'noopener,noreferrer')
    return 'failed'
  }

  const file = new File([blob], filename, { type: 'image/png' })

  if (canShareFiles(file)) {
    try {
      await navigator.share({
        files: [file],
        text,
        url: deepLink,
        title: opts.workTitle,
      })
      return 'shared'
    } catch (err) {
      const name =
        err && typeof err === 'object' && 'name' in err
          ? String((err as { name: string }).name)
          : ''
      if (name === 'AbortError') return 'cancelled'
      // Fall through to download + intent
    }
  }

  downloadPng(blob, filename)
  window.open(twitterIntentUrl(text), '_blank', 'noopener,noreferrer')
  return 'downloaded'
}
