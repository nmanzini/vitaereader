import { DAY_THEME } from './designContract.ts'

/**
 * Client-side quote card (canvas PNG) for share flows.
 * Fixed day-theme palette from designContract — independent of reader themes
 * (colors-only invariant). X/Threads web intents cannot attach images; share
 * orchestration lives in `shareQuote.ts`.
 *
 * Width is fixed; height adapts to wrapped quote + attribution (no empty square void).
 */

export const QUOTE_CARD_W = 1080
/** Short quotes still feel like a card, not a stub. */
export const QUOTE_CARD_MIN_H = 720
/** Cap tall cards so share previews stay manageable. */
export const QUOTE_CARD_MAX_H = 1350

const MAX_CARD_QUOTE = 360
const MAX_QUOTE_LINES = 12
const QUOTE_LINE_H = 58
const TITLE_LINE_H = 40

/** Layout rhythm (px) — content-driven; no flex spacer between quote and footer. */
const FRAME_INSET = 40
const PAD_X = 88
const PAD_TOP = 72
const PAD_BOTTOM = 72
const MARK_BLOCK = 88
const QUOTE_TO_RULE = 36
const RULE_TO_ATTR = 28
const CREDIT_GAP = 10
const CREDIT_LINE = 32
const SITE_GAP = 22
const SITE_LINE = 28

/** Calm book palette (locked day theme — not theme-driven). */
const COLORS = {
  bg: DAY_THEME.bg,
  ink: DAY_THEME.ink,
  muted: DAY_THEME.inkMuted,
  accent: DAY_THEME.accent,
  rule: 'rgba(26, 24, 20, 0.12)',
} as const

export type QuoteCardInput = {
  quote: string
  workTitle: string
  /** Default: Plutarch */
  author?: string
  /** Default: Parallel Lives */
  collection?: string
  /** Deep link or site URL baked into the card footer (current origin + base). */
  siteUrl: string
}

export type QuoteCardMetrics = {
  width: number
  height: number
  contentHeight: number
  /** Top offset when min-height pads short quotes (centers the block as a unit). */
  blockOffsetY: number
  quoteLineCount: number
  titleLineCount: number
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

/**
 * Content height for quote + attribution stack (before min/max clamp).
 * Pure helper for tests and adaptive canvas sizing.
 */
export function quoteCardContentHeight(
  quoteLineCount: number,
  titleLineCount = 1,
): number {
  const q = Math.max(0, quoteLineCount)
  const t = Math.max(1, titleLineCount)
  return (
    PAD_TOP +
    MARK_BLOCK +
    q * QUOTE_LINE_H +
    QUOTE_TO_RULE +
    RULE_TO_ATTR +
    t * TITLE_LINE_H +
    CREDIT_GAP +
    CREDIT_LINE +
    SITE_GAP +
    SITE_LINE +
    PAD_BOTTOM
  )
}

/** Clamp content height into the card range; center short stacks within min height. */
export function measureQuoteCard(opts: {
  quoteLineCount: number
  titleLineCount?: number
}): QuoteCardMetrics {
  const titleLineCount = opts.titleLineCount ?? 1
  const contentHeight = quoteCardContentHeight(
    opts.quoteLineCount,
    titleLineCount,
  )
  const height = Math.min(
    QUOTE_CARD_MAX_H,
    Math.max(QUOTE_CARD_MIN_H, contentHeight),
  )
  const blockOffsetY =
    contentHeight < height ? Math.floor((height - contentHeight) / 2) : 0
  return {
    width: QUOTE_CARD_W,
    height,
    contentHeight,
    blockOffsetY,
    quoteLineCount: opts.quoteLineCount,
    titleLineCount,
  }
}

/** Max quote lines that still fit under QUOTE_CARD_MAX_H. */
export function maxQuoteLinesForCard(titleLineCount = 1): number {
  const fixed = quoteCardContentHeight(0, titleLineCount)
  const budget = QUOTE_CARD_MAX_H - fixed
  const fromHeight = Math.max(1, Math.floor(budget / QUOTE_LINE_H))
  return Math.min(MAX_QUOTE_LINES, fromHeight)
}

/** Strip protocol + trailing slash for a quiet footer mark. */
export function displaySiteHost(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
}

/**
 * Card footer label: prefer path without long `?r=` tokens; ellipsize if needed.
 * Full deep link still goes in citation / X / Threads text.
 */
export function displayCardUrl(url: string, maxLen = 52): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  let label = displaySiteHost(trimmed)
  // Drop query/hash so a long selection token doesn't dominate the card.
  const q = label.indexOf('?')
  if (q >= 0) label = label.slice(0, q)
  const h = label.indexOf('#')
  if (h >= 0) label = label.slice(0, h)
  label = label.replace(/\/+$/, '')
  if (label.length <= maxLen) return label
  return `${label.slice(0, Math.max(1, maxLen - 1))}…`
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
 * Height adapts to wrapped quote + attribution (clamped min/max).
 * Awaits document fonts when available so serif faces can load.
 */
export async function drawQuoteCard(
  canvas: HTMLCanvasElement,
  input: QuoteCardInput,
): Promise<HTMLCanvasElement> {
  const w = QUOTE_CARD_W
  const contentW = w - PAD_X * 2

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      /* use fallbacks */
    }
  }

  const quote = truncateForCard(input.quote)
  const { title, credit } = cardAttribution(
    input.workTitle,
    input.author,
    input.collection,
  )
  const siteLabel = displayCardUrl(input.siteUrl)

  // Measure title wrap first (affects max quote lines under height cap).
  ctx.font =
    '600 32px "Source Serif 4", Georgia, "Times New Roman", serif'
  const titleLines = fitLines(
    wrapText(title, contentW, (s) => canvasMeasure(ctx, s)),
    2,
  )

  ctx.font =
    'italic 44px "Cormorant Garamond", Georgia, "Times New Roman", serif'
  const maxLines = maxQuoteLinesForCard(titleLines.length)
  const quoteLines = fitLines(
    wrapText(quote, contentW, (s) => canvasMeasure(ctx, s)),
    maxLines,
  )

  const metrics = measureQuoteCard({
    quoteLineCount: Math.max(1, quoteLines.length),
    titleLineCount: titleLines.length,
  })
  const h = metrics.height
  const oy = metrics.blockOffsetY

  canvas.width = w
  canvas.height = h

  // Background
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, w, h)

  // Thin outer rule
  ctx.strokeStyle = COLORS.rule
  ctx.lineWidth = 2
  ctx.strokeRect(FRAME_INSET, FRAME_INSET, w - FRAME_INSET * 2, h - FRAME_INSET * 2)

  const padX = PAD_X
  let y = oy + PAD_TOP

  // Opening mark
  ctx.fillStyle = COLORS.accent
  ctx.font = 'italic 120px "Cormorant Garamond", Georgia, "Times New Roman", serif'
  ctx.textBaseline = 'top'
  ctx.fillText('“', padX - 8, y - 8)
  y += MARK_BLOCK

  // Quote (tight stack — attribution follows immediately)
  ctx.fillStyle = COLORS.ink
  ctx.font =
    'italic 44px "Cormorant Garamond", Georgia, "Times New Roman", serif'
  for (const line of quoteLines) {
    ctx.fillText(line, padX, y)
    y += QUOTE_LINE_H
  }

  y += QUOTE_TO_RULE

  // Soft rule above attribution
  ctx.strokeStyle = COLORS.rule
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(padX, y)
  ctx.lineTo(padX + Math.min(160, contentW * 0.35), y)
  ctx.stroke()

  y += RULE_TO_ATTR

  ctx.fillStyle = COLORS.ink
  ctx.font =
    '600 32px "Source Serif 4", Georgia, "Times New Roman", serif'
  for (const line of titleLines) {
    ctx.fillText(line, padX, y)
    y += TITLE_LINE_H
  }

  ctx.fillStyle = COLORS.muted
  ctx.font =
    '400 26px "Source Serif 4", Georgia, "Times New Roman", serif'
  ctx.fillText(credit, padX, y + CREDIT_GAP)
  y += CREDIT_GAP + CREDIT_LINE

  ctx.fillStyle = COLORS.accent
  ctx.font =
    '400 22px "Source Serif 4", Georgia, "Times New Roman", serif'
  ctx.fillText(siteLabel, padX, y + SITE_GAP)

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
