/**
 * Kindle-like reading type prefs — separate from color themes.
 * Changing these remasures CSS columns; progress stays content-anchored.
 */

export type TypeFontId = 'book' | 'classic' | 'literary' | 'georgia'
export type TypeSizeId = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type TypeLeadingId = 'tight' | 'normal' | 'relaxed'
export type TypeMarginId = 'narrow' | 'normal' | 'wide'

export type ReadingPrefs = {
  font: TypeFontId
  size: TypeSizeId
  leading: TypeLeadingId
  margin: TypeMarginId
}

const STORAGE_KEY = 'vitae.reading'

export const TYPE_FONTS: { id: TypeFontId; label: string }[] = [
  { id: 'book', label: 'Book' },
  { id: 'classic', label: 'Classic' },
  { id: 'literary', label: 'Literary' },
  { id: 'georgia', label: 'Georgia' },
]

export const TYPE_SIZES: TypeSizeId[] = ['xs', 'sm', 'md', 'lg', 'xl']

export const TYPE_LEADINGS: { id: TypeLeadingId; label: string }[] = [
  { id: 'tight', label: 'Tight' },
  { id: 'normal', label: 'Normal' },
  { id: 'relaxed', label: 'Relaxed' },
]

export const TYPE_MARGINS: { id: TypeMarginId; label: string }[] = [
  { id: 'narrow', label: 'Narrow' },
  { id: 'normal', label: 'Normal' },
  { id: 'wide', label: 'Wide' },
]

export const DEFAULT_READING_PREFS: ReadingPrefs = {
  font: 'book',
  size: 'md',
  leading: 'normal',
  margin: 'normal',
}

function isFont(v: unknown): v is TypeFontId {
  return TYPE_FONTS.some((f) => f.id === v)
}
function isSize(v: unknown): v is TypeSizeId {
  return TYPE_SIZES.includes(v as TypeSizeId)
}
function isLeading(v: unknown): v is TypeLeadingId {
  return TYPE_LEADINGS.some((l) => l.id === v)
}
function isMargin(v: unknown): v is TypeMarginId {
  return TYPE_MARGINS.some((m) => m.id === v)
}

/** Normalize unknown JSON into a full ReadingPrefs object. */
export function normalizeReadingPrefs(raw: unknown): ReadingPrefs {
  const o =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    font: isFont(o.font) ? o.font : DEFAULT_READING_PREFS.font,
    size: isSize(o.size) ? o.size : DEFAULT_READING_PREFS.size,
    leading: isLeading(o.leading) ? o.leading : DEFAULT_READING_PREFS.leading,
    margin: isMargin(o.margin) ? o.margin : DEFAULT_READING_PREFS.margin,
  }
}

export function loadReadingPrefs(): ReadingPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_READING_PREFS }
    return normalizeReadingPrefs(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_READING_PREFS }
  }
}

export function saveReadingPrefs(prefs: ReadingPrefs): void {
  const next = normalizeReadingPrefs(prefs)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  applyReadingPrefs(next)
}

/** Stable key for remount/remasure when type metrics change. */
export function readingPrefsLayoutKey(prefs: ReadingPrefs): string {
  return `${prefs.font}:${prefs.size}:${prefs.leading}:${prefs.margin}`
}

/**
 * Apply type metrics via data-* on <html>.
 * Themes ([data-theme]) must never set these — pagination stays color-invariant.
 */
export function applyReadingPrefs(prefs: ReadingPrefs): void {
  const root = document.documentElement
  root.setAttribute('data-type-font', prefs.font)
  root.setAttribute('data-type-size', prefs.size)
  root.setAttribute('data-type-leading', prefs.leading)
  root.setAttribute('data-type-margin', prefs.margin)
}

export function stepTypeSize(
  current: TypeSizeId,
  delta: -1 | 1,
): TypeSizeId {
  const i = TYPE_SIZES.indexOf(current)
  const next = Math.max(0, Math.min(TYPE_SIZES.length - 1, i + delta))
  return TYPE_SIZES[next]!
}
