import type { CorpusIndex, IndexPair, IndexWorkRef } from './corpus'

export type LibraryEntry =
  | { kind: 'pair'; pair: IndexPair }
  | { kind: 'work'; work: IndexWorkRef }

/**
 * Unpaired lives woven into the pair sequence by rough historical place
 * (Clough prints them as a coda; here they sit where they “kinda” belong).
 *
 * - Artaxerxes II ≈ Agesilaus’s generation
 * - Aratus ≈ Cleomenes / late Achaean League
 * - Galba & Otho after the Republican pairs
 */
const AFTER_PAIR: Record<string, string[]> = {
  'agesilaus-pompey': ['artaxerxes'],
  'agis-gracchi': ['aratus'],
  'dion-marcus-brutus': ['galba', 'otho'],
}

/** Single home-list order: pairs + unpaired interleaved. */
export function libraryEntries(index: CorpusIndex): LibraryEntry[] {
  const byId = new Map(index.unpaired.map((w) => [w.id, w]))
  const entries: LibraryEntry[] = []
  const placed = new Set<string>()

  for (const pair of index.pairs) {
    entries.push({ kind: 'pair', pair })
    for (const id of AFTER_PAIR[pair.slug] ?? []) {
      const work = byId.get(id)
      if (!work) continue
      entries.push({ kind: 'work', work })
      placed.add(id)
    }
  }

  // Any unpaired missing from the map still appears at the end.
  for (const work of index.unpaired) {
    if (!placed.has(work.id)) entries.push({ kind: 'work', work })
  }

  return entries
}

/** Flatten library entries to works in catalog order (greek → roman → comparison). */
export function worksInLibraryOrder(index: CorpusIndex): IndexWorkRef[] {
  const out: IndexWorkRef[] = []
  for (const entry of libraryEntries(index)) {
    if (entry.kind === 'pair') {
      const { pair } = entry
      out.push(
        ...pair.greek,
        ...pair.roman,
        ...(pair.comparison ? [pair.comparison] : []),
      )
    } else {
      out.push(entry.work)
    }
  }
  return out
}
