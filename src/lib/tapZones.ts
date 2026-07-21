/**
 * Kindle-like tap thirds over the visible page box.
 * Outer gutters (x outside [pageLeft, pageLeft+pageWidth]) inherit L/R —
 * do not use the full viewport width or a centered measure collapses into
 * the center third on wide screens.
 */
export function tapZoneAt(
  clientX: number,
  pageLeft: number,
  pageWidth: number,
): 'prev' | 'next' | 'center' {
  if (pageWidth <= 0) return 'center'
  const x = clientX - pageLeft
  const third = pageWidth / 3
  if (x < third) return 'prev'
  if (x > third * 2) return 'next'
  return 'center'
}
