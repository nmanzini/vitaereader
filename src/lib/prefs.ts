export type ThemeId = 'day' | 'night' | 'sepia' | 'eink'
export type LayoutId = 'scroll' | 'pages'

const THEME_KEY = 'vitae.theme'
const LAYOUT_KEY = 'vitae.layout'
const PROGRESS_KEY = 'vitae.progress'
const FINISHED_KEY = 'vitae.finished'
const FOOTER_STATS_KEY = 'vitae.footerStats'

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'night', label: 'Night' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'eink', label: 'E-ink' },
]

export const LAYOUTS: { id: LayoutId; label: string; hint: string }[] = [
  { id: 'scroll', label: 'Scroll', hint: 'Continuous reading' },
  { id: 'pages', label: 'Pages', hint: 'Swipe like a book' },
]

export function loadTheme(): ThemeId {
  const v = localStorage.getItem(THEME_KEY) as ThemeId | null
  return THEMES.some((t) => t.id === v) ? (v as ThemeId) : 'day'
}

export function setTheme(theme: ThemeId) {
  localStorage.setItem(THEME_KEY, theme)
  document.documentElement.setAttribute('data-theme', theme)
}

export function loadLayout(): LayoutId {
  const v = localStorage.getItem(LAYOUT_KEY) as LayoutId | null
  return LAYOUTS.some((l) => l.id === v) ? (v as LayoutId) : 'scroll'
}

export function setLayout(layout: LayoutId) {
  localStorage.setItem(LAYOUT_KEY, layout)
}

export function loadFooterStats(): boolean {
  return localStorage.getItem(FOOTER_STATS_KEY) !== '0'
}

export function setFooterStats(on: boolean) {
  localStorage.setItem(FOOTER_STATS_KEY, on ? '1' : '0')
}

export type ProgressMap = Record<string, number>

export function loadProgress(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') as ProgressMap
  } catch {
    return {}
  }
}

export function saveProgress(workId: string, ratio: number) {
  const map = loadProgress()
  map[workId] = Math.min(1, Math.max(0, ratio))
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
