/**
 * Kindle / Silk / old-WebKit compatibility helpers.
 * E-ink Experimental Browser is ~Safari 5-era; Fire Silk is much newer.
 */

/** True for Amazon e-ink Experimental Browser (not modern Fire Silk). */
export function isLegacyKindleBrowser(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): boolean {
  // Classic Kindle UA: arm Linux WebKit 53x, often includes "Kindle/".
  // Exclude modern Silk (Chromium) used on Fire tablets.
  if (/Silk\//i.test(ua) && !/Kindle\/3\.0/i.test(ua)) return false
  if (/Kindle/i.test(ua) && /AppleWebKit\/53[0-4]/i.test(ua)) return true
  if (/X11;.*armv7l/i.test(ua) && /AppleWebKit\/53[0-4]/i.test(ua)) return true
  return false
}

/** Runtime features we need for the pages reader. */
export function pagesEngineSupported(): boolean {
  if (typeof document === 'undefined') return false
  try {
    if (typeof Promise === 'undefined') return false
    if (typeof fetch !== 'function') return false
    const el = document.createElement('div')
    // column-width or -webkit-column-width
    el.style.columnWidth = '80px'
    const webkit = (el.style as CSSStyleDeclaration & {
      webkitColumnWidth?: string
    }).webkitColumnWidth
    if (!el.style.columnWidth && !webkit) return false
    return true
  } catch {
    return false
  }
}

/** Observe size changes without requiring ResizeObserver. */
export function observeSize(
  el: Element,
  onChange: () => void,
): () => void {
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => onChange())
    ro.observe(el)
    return () => ro.disconnect()
  }
  window.addEventListener('resize', onChange)
  window.addEventListener('orientationchange', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('orientationchange', onChange)
  }
}

export function setTransformX(el: HTMLElement, x: number): void {
  const value = `translate3d(${x}px, 0, 0)`
  el.style.transform = value
  const s = el.style as CSSStyleDeclaration & { webkitTransform?: string }
  s.webkitTransform = value
}
