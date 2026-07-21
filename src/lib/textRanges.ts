/**
 * Paragraph text ranges for user highlights + character refs.
 * Offsets are into plain paragraph text (same space as charMatch).
 */

export type HighlightSpan = {
  id: string
  start: number
  end: number
}

export type RichSegment =
  | { type: 'text'; text: string; highlightIds: string[] }
  | { type: 'char'; text: string; characterId: string; highlightIds: string[] }

/** Clamp + normalize a half-open [start, end) into text bounds. */
export function normalizeRange(
  start: number,
  end: number,
  length: number,
): { start: number; end: number } | null {
  if (!Number.isFinite(start) || !Number.isFinite(end) || length <= 0) {
    return null
  }
  const a = Math.max(0, Math.min(length, Math.floor(start)))
  const b = Math.max(0, Math.min(length, Math.floor(end)))
  if (b <= a) return null
  return { start: a, end: b }
}

/** True when [a0,a1) and [b0,b1) overlap (share at least one character). */
export function rangesOverlap(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): boolean {
  return a0 < b1 && b0 < a1
}

/**
 * Merge overlapping/adjacent spans (same id coalesced; different ids that
 * touch stay separate so each highlight keeps identity).
 */
export function mergeHighlightSpans(
  spans: readonly HighlightSpan[],
): HighlightSpan[] {
  if (spans.length === 0) return []
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end)
  const out: HighlightSpan[] = []
  for (const s of sorted) {
    const prev = out[out.length - 1]
    if (prev && prev.id === s.id && s.start <= prev.end) {
      prev.end = Math.max(prev.end, s.end)
      continue
    }
    out.push({ id: s.id, start: s.start, end: s.end })
  }
  return out
}

type CharSpan = { start: number; end: number; characterId: string }

/**
 * Split plain text into atomic segments so highlights (background) and
 * character refs (tappable) can compose on overlapping ranges.
 */
export function segmentWithHighlights(
  text: string,
  charMatches: readonly CharSpan[],
  highlights: readonly HighlightSpan[],
): RichSegment[] {
  if (!text) return []

  const breaks = new Set<number>([0, text.length])
  for (const m of charMatches) {
    breaks.add(Math.max(0, Math.min(text.length, m.start)))
    breaks.add(Math.max(0, Math.min(text.length, m.end)))
  }
  for (const h of highlights) {
    breaks.add(Math.max(0, Math.min(text.length, h.start)))
    breaks.add(Math.max(0, Math.min(text.length, h.end)))
  }
  const points = [...breaks].sort((a, b) => a - b)

  const segments: RichSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]!
    const end = points[i + 1]!
    if (end <= start) continue
    const slice = text.slice(start, end)
    const highlightIds = highlights
      .filter((h) => rangesOverlap(start, end, h.start, h.end))
      .map((h) => h.id)
    const char = charMatches.find((m) => start >= m.start && end <= m.end)
    if (char) {
      segments.push({
        type: 'char',
        text: slice,
        characterId: char.characterId,
        highlightIds,
      })
    } else {
      segments.push({ type: 'text', text: slice, highlightIds })
    }
  }
  return segments
}

/** Find a stored highlight that fully contains [start, end). */
export function findContainingHighlight(
  highlights: readonly HighlightSpan[],
  start: number,
  end: number,
): HighlightSpan | null {
  const norm = normalizeRange(start, end, Number.MAX_SAFE_INTEGER)
  if (!norm) return null
  for (const h of highlights) {
    if (h.start <= norm.start && h.end >= norm.end) return h
  }
  return null
}
