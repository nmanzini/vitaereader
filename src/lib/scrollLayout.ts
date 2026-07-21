/**
 * Scroll-mode viewport sizing: keep the visible clip an integer multiple of
 * body line-height so resting frames don’t bisect glyphs at the clip edges.
 */

/** Floor available height to a whole number of body line boxes (CSS px). */
export function fitHeightToLineMultiple(
  availablePx: number,
  lineHeightPx: number,
): number {
  const available = Math.max(0, Math.floor(availablePx))
  const lh = Math.max(1, lineHeightPx)
  if (available < lh) return available
  const n = Math.floor(available / lh)
  return Math.floor(n * lh)
}

/** Computed line-height in CSS pixels from a body text sample. */
export function measureLineHeightPx(el: Element): number {
  const cs = getComputedStyle(el)
  const lh = Number.parseFloat(cs.lineHeight)
  if (Number.isFinite(lh) && lh > 0) return lh
  const fs = Number.parseFloat(cs.fontSize)
  if (Number.isFinite(fs) && fs > 0) return fs * 1.65
  return 16 * 1.65
}

/**
 * Size the scroll clip so clientHeight ≈ N × body line-height.
 * Leftover band space is split as vertical margins — outer flex chrome
 * spacers stay the same height (overlay chrome must not resize reading).
 * Returns the fitted height, or null if unmeasurable.
 */
export function applyScrollClipLineFit(clip: HTMLElement): number | null {
  clip.style.flex = '1 1 0'
  clip.style.height = ''
  clip.style.marginTop = ''
  clip.style.marginBottom = ''
  clip.style.minHeight = '0'

  void clip.offsetHeight

  const available = clip.clientHeight
  if (available < 2) return null

  const sample =
    clip.querySelector(
      '.reader-body .p-prose, .reader-body .p-noindent, .reader-body',
    ) ?? clip
  const lh = measureLineHeightPx(sample)
  const fitted = fitHeightToLineMultiple(available, lh)
  const slack = available - fitted

  if (slack < 1) return fitted

  const top = Math.floor(slack / 2)
  const bottom = slack - top
  clip.style.flex = '0 0 auto'
  clip.style.height = `${fitted}px`
  clip.style.marginTop = `${top}px`
  clip.style.marginBottom = `${bottom}px`

  return fitted
}
