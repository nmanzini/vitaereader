/**
 * Flatten / sort / group user highlights for the Highlights page.
 */
import type { HighlightsMap, TextHighlight } from './prefs'

export type HighlightEntry = TextHighlight & {
  workId: string
  workTitle: string
}

export type HighlightBookGroup = {
  workId: string
  workTitle: string
  highlights: HighlightEntry[]
}

export function flattenHighlights(
  map: HighlightsMap,
  titleById: ReadonlyMap<string, string>,
): HighlightEntry[] {
  const rows: HighlightEntry[] = []
  for (const [workId, list] of Object.entries(map)) {
    if (!Array.isArray(list)) continue
    const workTitle = titleById.get(workId) ?? workId
    for (const h of list) {
      if (!h || typeof h !== 'object' || !h.id) continue
      rows.push({
        ...h,
        workId,
        workTitle,
      })
    }
  }
  return rows
}

/** Newest first. */
export function sortHighlightsRecent(
  rows: readonly HighlightEntry[],
): HighlightEntry[] {
  return [...rows].sort(
    (a, b) =>
      (b.createdAt ?? 0) - (a.createdAt ?? 0) ||
      a.workId.localeCompare(b.workId) ||
      paraOrderKey(a.paraId) - paraOrderKey(b.paraId) ||
      a.start - b.start,
  )
}

/** Paragraph reading order within a work (numeric suffix, then start). */
export function sortHighlightsInWork(
  rows: readonly HighlightEntry[],
): HighlightEntry[] {
  return [...rows].sort(
    (a, b) =>
      paraOrderKey(a.paraId) - paraOrderKey(b.paraId) ||
      a.start - b.start ||
      (a.createdAt ?? 0) - (b.createdAt ?? 0),
  )
}

/**
 * Group by work. Groups follow `workOrder` (library chronology);
 * unknown works append at the end. Inside each group: reading order.
 */
export function groupHighlightsByBook(
  rows: readonly HighlightEntry[],
  workOrder: readonly string[],
): HighlightBookGroup[] {
  const byWork = new Map<string, HighlightEntry[]>()
  for (const row of rows) {
    const list = byWork.get(row.workId) ?? []
    list.push(row)
    byWork.set(row.workId, list)
  }

  const groups: HighlightBookGroup[] = []
  const seen = new Set<string>()

  for (const workId of workOrder) {
    const list = byWork.get(workId)
    if (!list?.length) continue
    seen.add(workId)
    groups.push({
      workId,
      workTitle: list[0]!.workTitle,
      highlights: sortHighlightsInWork(list),
    })
  }

  for (const [workId, list] of byWork) {
    if (seen.has(workId) || !list.length) continue
    groups.push({
      workId,
      workTitle: list[0]!.workTitle,
      highlights: sortHighlightsInWork(list),
    })
  }

  return groups
}

/** Extract trailing digits from para ids like `theseus-p012`. */
export function paraOrderKey(paraId: string): number {
  const m = /(\d+)\s*$/.exec(paraId)
  return m ? Number.parseInt(m[1]!, 10) : Number.MAX_SAFE_INTEGER
}
