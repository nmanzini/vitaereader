/** Words per minute for classic prose ETA. */
export const READING_WPM = 220

/** Estimate time left for remaining words. */
export function formatEta(
  remainingWords: number,
  wpm: number = READING_WPM,
): string {
  if (remainingWords <= 0) return 'Done'
  const minutes = Math.max(1, Math.ceil(remainingWords / wpm))
  if (minutes < 60) return `~${minutes} min left`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `~${h} hr left`
  return `~${h} hr ${m} min left`
}

export function pageCountFor(totalSize: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  // Subtract a pixel to absorb subpixel scrollWidth noise.
  return Math.max(1, Math.ceil((totalSize - 1) / pageSize))
}

export function pageIndexFromProgress(
  progress: number,
  pageCount: number,
): number {
  if (pageCount <= 1) return 0
  const target = Math.round(progress * (pageCount - 1))
  return Math.min(Math.max(0, target), pageCount - 1)
}

export function progressFromPage(pageIndex: number, pageCount: number): number {
  if (pageCount <= 1) return 1
  return pageIndex / (pageCount - 1)
}

/**
 * Kindle-style locations: stable units through a book (~16 words of prose,
 * near Amazon's historical ~128-byte chunks for English text).
 */
export const WORDS_PER_LOCATION = 16

export function locationCountFor(
  wordCount: number,
  wordsPerLoc: number = WORDS_PER_LOCATION,
): number {
  if (wordCount <= 0) return 1
  return Math.max(1, Math.ceil(wordCount / wordsPerLoc))
}

/** 1-based location from a 0–1 reading progress. */
export function locationFromProgress(
  progress: number,
  locationCount: number,
): number {
  if (locationCount <= 1) return 1
  const clamped = Math.min(1, Math.max(0, progress))
  return Math.min(
    locationCount,
    Math.max(1, Math.round(clamped * (locationCount - 1)) + 1),
  )
}
