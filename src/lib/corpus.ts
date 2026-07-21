import type { Work } from '../content/types'
import type { WorkAnnotations } from './charMatch'

export interface IndexWorkRef {
  id: string
  title: string
  wordCount: number
  culture?: 'greek' | 'roman'
}

export interface IndexPair {
  id: string
  slug: string
  title: string
  greek: IndexWorkRef[]
  roman: IndexWorkRef[]
  comparison: IndexWorkRef | null
}

export interface CorpusIndex {
  meta: {
    gutenbergId: number
    title: string
    translator: string
    editor: string
    sourceUrl: string
  }
  pairs: IndexPair[]
  unpaired: IndexWorkRef[]
  totals: {
    works: number
    pairs: number
    unpaired: number
    words: number
  }
}

let indexCache: CorpusIndex | null = null

/** Respect Vite `base` (e.g. `/vitaereader/` on GitHub Pages). */
function dataUrl(path: string): string {
  const base = import.meta.env.BASE_URL
  return `${base}data/${path}`
}

export async function loadIndex(): Promise<CorpusIndex> {
  if (indexCache) return indexCache
  const res = await fetch(dataUrl('index.json'))
  if (!res.ok) throw new Error('Failed to load corpus index')
  indexCache = (await res.json()) as CorpusIndex
  return indexCache
}

export async function loadWork(slug: string): Promise<Work> {
  const res = await fetch(dataUrl(`works/${slug}.json`))
  if (!res.ok) throw new Error(`Work not found: ${slug}`)
  return res.json() as Promise<Work>
}

/**
 * Per-work character highlights. Missing file → null (no highlights).
 * Safe corpus-wide: works without annotations simply skip the feature.
 */
export async function loadAnnotations(
  workId: string,
): Promise<WorkAnnotations | null> {
  const res = await fetch(dataUrl(`annotations/${workId}.json`))
  if (!res.ok) return null
  // Dev SPA / static hosts may return index.html (200) for missing files.
  try {
    const data = (await res.json()) as WorkAnnotations
    if (!data?.workId || !Array.isArray(data.characters)) return null
    return data
  } catch {
    return null
  }
}

export function pairWorks(pair: IndexPair): IndexWorkRef[] {
  return [
    ...pair.greek,
    ...pair.roman,
    ...(pair.comparison ? [pair.comparison] : []),
  ]
}

export function findPairForWork(index: CorpusIndex, workId: string) {
  return (
    index.pairs.find((p) => pairWorks(p).some((w) => w.id === workId)) ?? null
  )
}
