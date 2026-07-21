import type { Work } from '../content/types'

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
