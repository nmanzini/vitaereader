export type ThemeId = 'day' | 'night' | 'sepia' | 'eink'

const THEME_KEY = 'vitae.theme'
const PROGRESS_KEY = 'vitae.progress'
const FINISHED_KEY = 'vitae.finished'
const HIGHLIGHTS_KEY = 'vitae.highlights'

/** Local user highlight — offsets into plain paragraph text. */
export type TextHighlight = {
  id: string
  paraId: string
  start: number
  end: number
  text: string
  createdAt: number
}

export type HighlightsMap = Record<string, TextHighlight[]>

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'night', label: 'Night' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'eink', label: 'E-ink' },
]

export function loadTheme(): ThemeId {
  const v = localStorage.getItem(THEME_KEY) as ThemeId | null
  return THEMES.some((t) => t.id === v) ? (v as ThemeId) : 'day'
}

export function setTheme(theme: ThemeId) {
  localStorage.setItem(THEME_KEY, theme)
  document.documentElement.setAttribute('data-theme', theme)
}

export type ProgressMap = Record<string, number>

/** In-memory cache — page turns must not re-parse localStorage every time. */
let progressCache: ProgressMap | null = null

export function loadProgress(): ProgressMap {
  if (progressCache) return progressCache
  try {
    progressCache = JSON.parse(
      localStorage.getItem(PROGRESS_KEY) ?? '{}',
    ) as ProgressMap
  } catch {
    progressCache = {}
  }
  return progressCache
}

export function saveProgress(workId: string, ratio: number) {
  const map = loadProgress()
  const next = Math.min(1, Math.max(0, ratio))
  if (map[workId] === next) return
  map[workId] = next
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(map))
}

export function loadFinished(): Set<string> {
  try {
    const arr = JSON.parse(localStorage.getItem(FINISHED_KEY) ?? '[]') as string[]
    return new Set(arr)
  } catch {
    return new Set()
  }
}

export function toggleFinished(id: string): Set<string> {
  const set = loadFinished()
  if (set.has(id)) set.delete(id)
  else set.add(id)
  localStorage.setItem(FINISHED_KEY, JSON.stringify([...set]))
  return set
}

export function formatWords(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k words`
  return `${n} words`
}

function newHighlightId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `hl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadHighlights(): HighlightsMap {
  try {
    const raw = JSON.parse(
      localStorage.getItem(HIGHLIGHTS_KEY) ?? '{}',
    ) as HighlightsMap
    if (!raw || typeof raw !== 'object') return {}
    return raw
  } catch {
    return {}
  }
}

export function loadHighlightsFor(workId: string): TextHighlight[] {
  const list = loadHighlights()[workId]
  return Array.isArray(list) ? list : []
}

export function addHighlight(
  workId: string,
  input: Omit<TextHighlight, 'id' | 'createdAt'> & {
    id?: string
    createdAt?: number
  },
): TextHighlight {
  const map = loadHighlights()
  const list = Array.isArray(map[workId]) ? [...map[workId]!] : []
  const highlight: TextHighlight = {
    id: input.id ?? newHighlightId(),
    paraId: input.paraId,
    start: input.start,
    end: input.end,
    text: input.text,
    createdAt: input.createdAt ?? Date.now(),
  }
  list.push(highlight)
  map[workId] = list
  localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(map))
  return highlight
}

/**
 * Return an existing exact-range highlight, or create one.
 * Used when opening a share deep-link (`?r=`) so the passage shows marked.
 */
export function ensureHighlight(
  workId: string,
  input: Omit<TextHighlight, 'id' | 'createdAt'>,
): TextHighlight {
  const existing = loadHighlightsFor(workId).find(
    (h) =>
      h.paraId === input.paraId &&
      h.start === input.start &&
      h.end === input.end,
  )
  if (existing) return existing
  return addHighlight(workId, input)
}

export function removeHighlight(workId: string, highlightId: string): boolean {
  const map = loadHighlights()
  const list = map[workId]
  if (!Array.isArray(list)) return false
  const next = list.filter((h) => h.id !== highlightId)
  if (next.length === list.length) return false
  map[workId] = next
  localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(map))
  return true
}
