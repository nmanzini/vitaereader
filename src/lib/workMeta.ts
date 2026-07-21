import type { Work } from '../content/types'
import type { IndexPair, IndexWorkRef } from './corpus'
import { pairWorks } from './corpus'

export function workKicker(work: Work, pair: IndexPair | null): string | null {
  const pairBit = pair ? ` · ${pair.title}` : ''
  if (work.kind === 'comparison') return `Comparison${pairBit}`
  if (work.culture === 'greek') return `Greek life${pairBit}`
  if (work.culture === 'roman') return `Roman life${pairBit}`
  return null
}

export function siblingNav(
  pair: IndexPair | null,
  workId: string,
): { prev: IndexWorkRef | null; next: IndexWorkRef | null } {
  if (!pair) return { prev: null, next: null }
  const siblings = pairWorks(pair)
  const i = siblings.findIndex((s) => s.id === workId)
  return {
    prev: i > 0 ? siblings[i - 1] : null,
    next: i >= 0 && i < siblings.length - 1 ? siblings[i + 1] : null,
  }
}
