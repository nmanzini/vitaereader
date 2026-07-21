/**
 * Client-side quote card (canvas PNG) for share flows.
 * Fixed tasteful palette — independent of reader themes (colors-only invariant).
 * X web intent cannot attach images; share orchestration lives in `shareQuote.ts`.
 */

export const QUOTE_CARD_W = 1080
export const QUOTE_CARD_H = 1080
const MAX_CARD_QUOTE = 360
const MAX_QUOTE_LINES = 9
const QUOTE_LINE_H = 64

/** Calm book palette (matches day theme tokens, not theme-driven). */
const COLORS = {
  bg: '#f3eee4',
  ink: '#1a1814',
  muted: '#5c574e',
  accent: '#2f4a3c',
  rule: 'rgba(26, 24, 20, 0.12)',
} as const

export type QuoteCardInput = {
  quote: string
  workTitle: string
  /** Default: Plutarch */
  author?: string
  /** Default: Parallel Lives */
  collection?: string
  /** Home URL baked into the card (e.g. https://nmanzini.github.io/vitaereader/) */
  siteUrl: string
}

/** Word-wrap using a width measure (canvas measureText or a stub in tests). */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  if (maxWidth <= 0) return [cleaned]

  const words = cleaned.split(' ')
  const lines: string[] = []
  let current = ''

  const pushHardBroken = (word: string) => {
    let rest = word
    while (rest.length > 0 && measure(rest) > maxWidth) {
      let lo = 1
      let hi = rest.length
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        if (measure(rest.slice(0, mid)) <= maxWidth) lo = mid
        else hi = mid - 1
      }
      if (lo < 1) lo = 1
      lines.push(rest.slice(0, lo))
      rest = rest.slice(lo)
    }
    current = rest
  }

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (measure(next) <= maxWidth) {
      current = next
      continue
    }
    if (current) lines.push(current)
    if (measure(word) > maxWidth) pushHardBroken(word)
    else current = word
  }
  if (current) lines.push(current)
  return lines
}

/** Cap line count; ellipsis on the last kept line. */
export function fitLines(lines: string[], maxLines: number): string[] {
  if (maxLines < 1) return []
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  const last = kept[maxLines - 1] ?? ''
  kept[maxLines - 1] = `${last.replace(/…$/, '').trimEnd()}…`
  return kept
}

/** Strip protocol + trailing slash for a quiet footer mark. */
export function displaySiteHost(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
}

export function truncateForCard(text: string, max = MAX_CARD_QUOTE): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  const cut = cleaned.slice(0, max - 1)
  const sp = cut.lastIndexOf(' ')
  const base = sp > max * 0.5 ? cut.slice(0, sp) : cut
  return `${base}…`
}

export function cardAttribution(
  workTitle: string,
  author = 'Plutarch',
  collection = 'Parallel Lives',
): { title: string; credit: string } {
  return {
    title: workTitle.trim(),
    credit: `${author} · ${collection}`,
  }
}

function canvasMeasure(ctx: CanvasRenderingContext2D, s: string): number {
  return ctx.measureText(s).width
}

/**
 * Draw a quiet quote card onto a canvas. Returns the same canvas.
 * Awaits document fonts when available so serif faces can load.
 */
export async function drawQuoteCard(
  canvas: HTMLCanvasElement,
  input: QuoteCardInput,
): Promise<HTMLCanvasElement> {
  const w = QUOTE_CARD_W
  const h = QUOTE_CARD_H
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      /* use fallbacks */
    }
  }

  const padX = 88
  const padTop = 96
  const padBottom = 88
  const contentW = w - padX * 2

  // Background
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, w, h)

  // Thin outer rule
  ctx.strokeStyle = COLORS.rule
  ctx.lineWidth = 2
  ctx.strokeRect(40, 40, w - 80, h - 80)

  // Opening mark
  ctx.fillStyle = COLORS.accent
  ctx.font = 'italic 120px "Cormorant Garamond", Georgia, "Times New Roman", serif'
  ctx.textBaseline = 'top'
  ctx.fillText('“', padX - 8, padTop - 24)

  const quote = truncateForCard(input.quote)
  ctx.fillStyle = COLORS.ink
  ctx.font =
    'italic 44px "Cormorant Garamond", Georgia, "Times New Roman", serif'
  const quoteTop = padTop + 100
  const attrBlockTop = h - padBottom - 96 - 36
  const maxQuoteH = Math.max(QUOTE_LINE_H, attrBlockTop - quoteTop - 24)
  const maxLines = Math.min(
    MAX_QUOTE_LINES,
    Math.max(1, Math.floor(maxQuoteH / QUOTE_LINE_H)),
  )
  const quoteLines = fitLines(
    wrapText(quote, contentW, (s) => canvasMeasure(ctx, s)),
    maxLines,
  )
  let y = quoteTop
  for (const line of quoteLines) {
    ctx.fillText(line, padX, y)
    y += QUOTE_LINE_H
  }

  const { title, credit } = cardAttribution(
    input.workTitle,
    input.author,
    input.collection,
  )

  // Attribution block near bottom (above site URL)
  const siteLabel = displaySiteHost(input.siteUrl)
  const footerY = h - padBottom
  let attrY = footerY - 96

  // Soft rule above attribution
  ctx.strokeStyle = COLORS.rule
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(padX, attrY - 36)
  ctx.lineTo(padX + Math.min(160, contentW * 0.35), attrY - 36)
  ctx.stroke()

  ctx.fillStyle = COLORS.ink
  ctx.font =
    '600 32px "Source Serif 4", Georgia, "Times New Roman", serif'
  const titleLines = fitLines(
    wrapText(title, contentW, (s) => canvasMeasure(ctx, s)),
    2,
  )
  for (const line of titleLines) {
    ctx.fillText(line, padX, attrY)
    attrY += 40
  }

  ctx.fillStyle = COLORS.muted
  ctx.font =
    '400 26px "Source Serif 4", Georgia, "Times New Roman", serif'
  ctx.fillText(credit, padX, attrY + 8)

  ctx.fillStyle = COLORS.accent
  ctx.font =
    '400 22px "Source Serif 4", Georgia, "Times New Roman", serif'
  ctx.fillText(siteLabel, padX, footerY)

  return canvas
}

/** Render quote card as a PNG Blob. */
export async function renderQuoteCardPng(
  input: QuoteCardInput,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  await drawQuoteCard(canvas, input)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to encode quote card PNG'))
      },
      'image/png',
    )
  })
}

export function quoteCardFileName(workTitle: string): string {
  const slug = workTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `vitae-${slug || 'quote'}.png`
}
