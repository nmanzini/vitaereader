/**
 * Tasteful short citation + deep-link URL for share intents.
 * Quote-card PNG rendering: `quoteCard.ts` (loaded on share via dynamic import).
 * Selection tokens: `selectionLink.ts`.
 */

import {
  encodeSelectionRanges,
  type SelectionRange,
} from './selectionLink.ts'

const PRODUCTION_ORIGIN = 'https://nmanzini.github.io'
const MAX_QUOTE = 180
const MAX_CITATION_QUOTE = 480

export type { SelectionRange }

export function truncateQuote(text: string, max = MAX_QUOTE): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  const cut = cleaned.slice(0, max - 1)
  const sp = cut.lastIndexOf(' ')
  const base = sp > max * 0.5 ? cut.slice(0, sp) : cut
  return `${base}…`
}

/** App origin+base for share links (current host + Vite base, or prod fallback). */
export function readerBaseUrl(
  origin = typeof window !== 'undefined' ? window.location.origin : '',
  base = typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/',
): string {
  const o = origin || PRODUCTION_ORIGIN
  const b = base.endsWith('/') ? base : `${base}/`
  return `${o}${b}`
}

/**
 * Site home for card footers when no quote deep-link is available.
 * Uses the live origin + Vite base (local or GH Pages).
 */
export function cardSiteHome(
  origin = typeof window !== 'undefined' ? window.location.origin : '',
  base = typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/',
): string {
  return readerBaseUrl(origin, base).replace(/\/?$/, '/')
}

export type WorkShareOptions = {
  paraId?: string
  /** Exact quote range(s); encoded as `r=` when present. */
  ranges?: readonly SelectionRange[]
  origin?: string
  base?: string
}

/**
 * Deep link to a work.
 * - `?p=<paraId>` resumes at that paragraph
 * - `?r=<base64url>` encodes selection range(s) for highlight restore
 */
export function workShareUrl(
  workSlug: string,
  options?: WorkShareOptions,
): string {
  const root = readerBaseUrl(options?.origin, options?.base).replace(
    /\/?$/,
    '/',
  )
  const path = `read/${encodeURIComponent(workSlug)}`
  const params = new URLSearchParams()
  const paraId = options?.paraId ?? options?.ranges?.[0]?.paraId
  if (paraId) params.set('p', paraId)
  if (options?.ranges?.length) {
    const token = encodeSelectionRanges(options.ranges)
    if (token) params.set('r', token)
  }
  const qs = params.toString()
  return qs ? `${root}${path}?${qs}` : `${root}${path}`
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

/**
 * Clipboard / preview citation: quote + work + author · Parallel Lives (+ optional URL).
 */
export function buildCitationText(
  workTitle: string,
  quote: string,
  opts?: {
    author?: string
    collection?: string
    url?: string
  },
): string {
  const q = truncateQuote(quote.replace(/\s+/g, ' ').trim(), MAX_CITATION_QUOTE)
  const author = opts?.author ?? 'Plutarch'
  const collection = opts?.collection ?? 'Parallel Lives'
  const lines = [
    q ? `“${q}”` : '',
    '',
    `— ${workTitle.trim()}`,
    `${author} · ${collection}`,
  ]
  if (opts?.url) {
    lines.push('', opts.url)
  }
  return lines.join('\n').replace(/^\n+|\n+$/g, '')
}

export function twitterIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
}

/** Threads web intent (text + optional link attachment). */
export function threadsIntentUrl(text: string, url?: string): string {
  const params = new URLSearchParams()
  if (text) params.set('text', text)
  if (url) params.set('url', url)
  const qs = params.toString()
  return qs
    ? `https://www.threads.com/intent/post?${qs}`
    : 'https://www.threads.com/intent/post'
}

export type SharePlatform = 'x' | 'threads'

export type ShareAssets = {
  citation: string
  shareText: string
  deepLink: string
  blob: Blob
  filename: string
}

export type CopyResult = 'copied' | 'downloaded' | 'failed'
export type IntentShareResult = 'opened' | 'failed'

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

function openIntent(url: string): IntentShareResult {
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win) {
      // Popup blocked — navigate top-level as last resort.
      window.location.assign(url)
    }
    return 'opened'
  } catch {
    return 'failed'
  }
}

/** Build citation + share text + quote-card PNG once for the share sheet. */
export async function prepareShareAssets(opts: {
  quote: string
  workTitle: string
  workId: string
  paraId?: string
  ranges?: readonly SelectionRange[]
}): Promise<ShareAssets> {
  const deepLink = workShareUrl(opts.workId, {
    paraId: opts.paraId,
    ranges: opts.ranges,
  })
  const shareText = buildShareText(opts.workTitle, opts.quote, deepLink)
  const citation = buildCitationText(opts.workTitle, opts.quote, {
    url: deepLink,
  })

  const { quoteCardFileName, renderQuoteCardPng } = await import('./quoteCard')
  const filename = quoteCardFileName(opts.workTitle)
  // Card footer: tasteful deep link to this quote (current origin + base).
  const blob = await renderQuoteCardPng({
    quote: opts.quote,
    workTitle: opts.workTitle,
    siteUrl: deepLink,
  })

  return { citation, shareText, deepLink, blob, filename }
}

export function shareViaIntent(
  platform: SharePlatform,
  shareText: string,
  deepLink?: string,
): IntentShareResult {
  if (platform === 'x') return openIntent(twitterIntentUrl(shareText))
  return openIntent(threadsIntentUrl(shareText, deepLink))
}

export async function copyCitationText(citation: string): Promise<CopyResult> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(citation)
      return 'copied'
    }
  } catch {
    /* fall through */
  }
  // Legacy fallback (Silk / older WebViews)
  try {
    const ta = document.createElement('textarea')
    ta.value = citation
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok ? 'copied' : 'failed'
  } catch {
    return 'failed'
  }
}

/**
 * Copy PNG via ClipboardItem when supported; otherwise download the file.
 */
export async function copyQuoteImage(
  blob: Blob,
  filename: string,
): Promise<CopyResult> {
  const itemCtor = typeof ClipboardItem !== 'undefined' ? ClipboardItem : null
  const canWrite =
    itemCtor &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function'

  if (canWrite && itemCtor) {
    try {
      // Safari often wants a Promise-valued ClipboardItem.
      const png = Promise.resolve(blob)
      await navigator.clipboard.write([
        new itemCtor({ 'image/png': png }),
      ])
      return 'copied'
    } catch {
      /* fall through to download */
    }
  }

  try {
    downloadPng(blob, filename)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}
