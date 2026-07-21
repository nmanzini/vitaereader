/**
 * Pure helpers for distinguishing page-swipe vs text-selection intent.
 * Tuned for mobile: almost the whole page is text, so clear horizontal
 * swipes must lock paging without a huge dead-zone.
 */

export const TAP_SLOP = 12
export const PAGE_DRAG_SLOP = 14
/** Extra slack when the press started on body text (protects selection). */
export const TEXT_PAGE_DRAG_SLOP = 28

/** Horizontal dominance that treats a text-start as a page swipe. */
const CLEAR_HORIZONTAL = 1.45
/** Vertical dominance that abandons paging for native selection. */
const CLEAR_VERTICAL = 1.2

export function dragSlopPx(startedOnText: boolean, absX: number, absY: number): number {
  if (!startedOnText) return PAGE_DRAG_SLOP
  // Clear sideways motion on text → use the tight slop (whole-page feel).
  if (absX > absY * CLEAR_HORIZONTAL) return PAGE_DRAG_SLOP
  return TEXT_PAGE_DRAG_SLOP
}

/** Vertical-ish move on text should yield to native selection, not paging. */
export function isVerticalSelectIntent(
  startedOnText: boolean,
  absX: number,
  absY: number,
): boolean {
  if (!startedOnText) return false
  return absY > 12 && absY > absX * CLEAR_VERTICAL
}

/**
 * Once past slop: lock paging, yield to selection, wait, or cancel.
 */
export function pendingMoveDecision(
  startedOnText: boolean,
  absX: number,
  absY: number,
): 'wait' | 'paging' | 'selecting' | 'cancel' {
  if (isVerticalSelectIntent(startedOnText, absX, absY)) return 'selecting'

  const slop = dragSlopPx(startedOnText, absX, absY)
  if (absX < slop) return 'wait'

  if (absX < absY) {
    return startedOnText ? 'selecting' : 'cancel'
  }

  return 'paging'
}
