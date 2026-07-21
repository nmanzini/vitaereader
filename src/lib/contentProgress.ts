/**
 * Content-anchored reading progress (Kindle-like).
 *
 * Stored value is a single 0–1 ratio = fraction of words through the work
 * (same idea as Kindle “locations”: a place in the text, not a viewport).
 * Scroll restores by paragraph; Pages restores by finding which column/page
 * actually contains that place after layout — not ratio × pageCount.
 */

export type WordIndex = {
  ids: string[]
  /** Word count of each paragraph. */
  words: number[]
  /** Cumulative words before paragraph i. */
  prefix: number[]
  total: number
}

/** Match ingest word counting (`scripts/text.mjs`). */
export function countWords(text: string): number {
  const m = text.match(/[A-Za-z0-9’'-]+/g)
  return m ? m.length : 0
}

export function buildWordIndex(
  paragraphs: readonly { id: string; text: string }[],
): WordIndex {
  const ids: string[] = []
  const words: number[] = []
  const prefix: number[] = []
  let total = 0
  for (const p of paragraphs) {
    ids.push(p.id)
    prefix.push(total)
    const n = countWords(p.text)
    words.push(n)
    total += n
  }
  return { ids, words, prefix, total: Math.max(1, total) }
}

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0
  return Math.min(1, Math.max(0, ratio))
}

/** Word offset (0…total) → content ratio. */
export function ratioFromWordOffset(offset: number, total: number): number {
  if (total <= 0) return 0
  return clampRatio(offset / total)
}

export function wordOffsetFromRatio(ratio: number, total: number): number {
  return clampRatio(ratio) * Math.max(0, total)
}

/** Map a paragraph + in-paragraph fraction (by characters ≈ words) to ratio. */
export function ratioFromAnchor(
  paraIndex: number,
  frac: number,
  index: WordIndex,
): number {
  if (index.ids.length === 0) return 0
  const i = Math.min(Math.max(0, paraIndex), index.ids.length - 1)
  const f = clampRatio(frac)
  const offset = index.prefix[i] + f * index.words[i]
  return ratioFromWordOffset(offset, index.total)
}

export function anchorFromRatio(
  ratio: number,
  index: WordIndex,
): { paraIndex: number; frac: number } {
  if (index.ids.length === 0) return { paraIndex: 0, frac: 0 }
  const target = wordOffsetFromRatio(ratio, index.total)
  let lo = 0
  let hi = index.ids.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (index.prefix[mid] <= target) lo = mid
    else hi = mid - 1
  }
  const span = index.words[lo] || 1
  const frac = clampRatio((target - index.prefix[lo]) / span)
  return { paraIndex: lo, frac }
}

function textOffsetInElement(
  root: Element,
  node: Node,
  offset: number,
): number | null {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let count = 0
  let current: Node | null
  while ((current = walk.nextNode())) {
    const len = current.textContent?.length ?? 0
    if (current === node) return count + Math.min(offset, len)
    count += len
  }
  return null
}

function caretFractionInParagraph(
  paraEl: HTMLElement,
  x: number,
  y: number,
): number | null {
  const text = paraEl.textContent ?? ''
  if (!text.length) return 0

  let offset: number | null = null
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }

  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y)
    if (pos && paraEl.contains(pos.offsetNode)) {
      offset = textOffsetInElement(paraEl, pos.offsetNode, pos.offset)
    }
  } else if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y)
    if (range && paraEl.contains(range.startContainer)) {
      offset = textOffsetInElement(
        paraEl,
        range.startContainer,
        range.startOffset,
      )
    }
  }

  if (offset == null) return null
  return clampRatio(offset / text.length)
}

/**
 * Relative sample points inside a viewport (origin = top-left).
 * Center-anchored with a small vertical cluster for hit-testing gaps.
 */
export function contentSamplePoints(
  width: number,
  height: number,
): { x: number; ys: number[] } {
  if (width < 2 || height < 2) return { x: 0, ys: [] }
  const x = Math.min(Math.max(width * 0.5, 8), width - 8)
  const midY = height * 0.5
  const dy = Math.min(18, height * 0.06)
  return { x, ys: [midY, midY - dy, midY + dy] }
}

/**
 * Scroll offset that places a content Y (relative to content top) at the
 * vertical center of the viewport.
 */
export function scrollTopForCenterAnchor(
  anchorOffsetInContent: number,
  viewportHeight: number,
  maxScroll: number,
): number {
  if (maxScroll <= 0) return 0
  return Math.min(
    maxScroll,
    Math.max(0, anchorOffsetInContent - viewportHeight / 2),
  )
}

/**
 * Measure content progress at an absolute client point inside `viewport`.
 * Returns null if nothing measurable at that point.
 */
export function measureContentRatioAt(
  viewport: HTMLElement,
  index: WordIndex,
  clientX: number,
  clientY: number,
): number | null {
  if (index.ids.length === 0) return 0

  const el = document.elementFromPoint(clientX, clientY)
  if (!el || !viewport.contains(el)) return null
  if (el.closest('.reader-footer-nav')) return 1
  if (el.closest('.reader-header') && !el.closest('[data-para-id]')) {
    return 0
  }

  const paraEl = el.closest('[data-para-id]') as HTMLElement | null
  if (!paraEl || !viewport.contains(paraEl)) return null
  const id = paraEl.getAttribute('data-para-id')
  if (!id) return null
  const paraIndex = index.ids.indexOf(id)
  if (paraIndex < 0) return null

  const frac = caretFractionInParagraph(paraEl, clientX, clientY) ?? 0
  return ratioFromAnchor(paraIndex, frac, index)
}

/**
 * Read content progress from the center of a viewport (scroll clip or paged
 * clip). Location = middle of what’s on screen. Returns null if unmeasurable.
 */
export function measureContentRatio(
  viewport: HTMLElement,
  index: WordIndex,
): number | null {
  if (index.ids.length === 0) return 0
  const rect = viewport.getBoundingClientRect()
  if (rect.width < 2 || rect.height < 2) return null

  const { x: relX, ys } = contentSamplePoints(rect.width, rect.height)
  const x = rect.left + relX

  for (const relY of ys) {
    const measured = measureContentRatioAt(
      viewport,
      index,
      x,
      rect.top + relY,
    )
    if (measured != null) return measured
  }

  return null
}

/**
 * Soft line settle: browsers do not snap scroll to line boxes natively.
 * After scrolling stops, nudge so the top edge sits on a line — only when
 * already close (proximity), so it feels invisible rather than magnetic.
 * Returns true if scrollTop changed.
 */
export function snapViewportTopToLine(viewport: HTMLElement): boolean {
  const max = viewport.scrollHeight - viewport.clientHeight
  if (max <= 0) return false
  if (viewport.scrollTop <= 1 || viewport.scrollTop >= max - 1) return false

  const view = viewport.getBoundingClientRect()
  const x = view.left + Math.min(40, view.width * 0.15)
  const y = view.top + 2

  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }

  let range: Range | null = null
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y)
    if (pos?.offsetNode) {
      range = document.createRange()
      range.setStart(pos.offsetNode, pos.offset)
      range.collapse(true)
    }
  } else if (typeof doc.caretRangeFromPoint === 'function') {
    range = doc.caretRangeFromPoint(x, y)
  }
  if (!range) return false

  const node =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement
  if (!node || !viewport.contains(node)) return false
  if (node.closest('.reader-header, .reader-footer-nav')) return false

  const rects = range.getClientRects()
  const line = rects.length > 0 ? rects[0] : range.getBoundingClientRect()
  if (!line || (line.height === 0 && line.width === 0)) return false

  const delta = line.top - view.top
  const limit = Math.min(40, Math.max(12, line.height * 0.55))
  if (Math.abs(delta) < 0.75 || Math.abs(delta) > limit) return false

  viewport.scrollTop = Math.min(max, Math.max(0, viewport.scrollTop + delta))
  return true
}

/** Map a horizontal flow offset to a page index in the multicol strip. */
export function pageIndexFromFlowX(
  flowX: number,
  pageWidth: number,
  pageCount: number,
): number {
  if (pageWidth <= 0 || pageCount <= 1) return 0
  return Math.min(
    pageCount - 1,
    Math.max(0, Math.floor(flowX / pageWidth)),
  )
}

function caretFlowX(
  contentRoot: HTMLElement,
  paraEl: HTMLElement,
  frac: number,
): number | null {
  const text = paraEl.textContent ?? ''
  if (!text.length) {
    return (
      paraEl.getBoundingClientRect().left -
      contentRoot.getBoundingClientRect().left
    )
  }

  const target = Math.min(
    text.length,
    Math.max(0, Math.floor(clampRatio(frac) * text.length)),
  )
  const walk = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT)
  let counted = 0
  let node: Node | null
  while ((node = walk.nextNode())) {
    const len = node.textContent?.length ?? 0
    if (counted + len >= target) {
      const range = document.createRange()
      range.setStart(node, Math.min(len, Math.max(0, target - counted)))
      range.collapse(true)
      const rects = range.getClientRects()
      const box = rects.length > 0 ? rects[0] : range.getBoundingClientRect()
      if (!box || (box.width === 0 && box.height === 0)) break
      return box.left - contentRoot.getBoundingClientRect().left
    }
    counted += len
  }

  return (
    paraEl.getBoundingClientRect().left -
    contentRoot.getBoundingClientRect().left
  )
}

/**
 * After CSS columns have laid out: which page contains this content ratio?
 * Uses geometry of the anchored caret/paragraph in the multicol flow
 * (Kindle: resolve location → show the page that holds it).
 */
function fallbackPageIndex(ratio: number, pageCount: number): number {
  if (pageCount <= 1) return 0
  const target = Math.round(clampRatio(ratio) * (pageCount - 1))
  return Math.min(Math.max(0, target), pageCount - 1)
}

export function pageIndexForContentRatio(
  contentRoot: HTMLElement,
  pageWidth: number,
  pageCount: number,
  index: WordIndex,
  ratio: number,
): number {
  const fallback = fallbackPageIndex(ratio, pageCount)
  if (pageWidth <= 0 || pageCount <= 1 || index.ids.length === 0) {
    return fallback
  }

  const r = clampRatio(ratio)
  if (r <= 0.005) return 0
  if (r >= 0.995) return pageCount - 1

  const { paraIndex, frac } = anchorFromRatio(r, index)
  const id = index.ids[paraIndex]
  const paraEl = contentRoot.querySelector(
    `[data-para-id="${CSS.escape(id)}"]`,
  ) as HTMLElement | null
  if (!paraEl) return fallback

  const flowX = caretFlowX(contentRoot, paraEl, frac)
  if (flowX == null || !Number.isFinite(flowX)) return fallback
  return pageIndexFromFlowX(flowX, pageWidth, pageCount)
}

function caretOffsetYInParagraph(
  paraEl: HTMLElement,
  frac: number,
): number | null {
  const text = paraEl.textContent ?? ''
  if (!text.length) return 0

  const target = Math.min(
    text.length,
    Math.max(0, Math.floor(clampRatio(frac) * text.length)),
  )
  const walk = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT)
  let counted = 0
  let node: Node | null
  while ((node = walk.nextNode())) {
    const len = node.textContent?.length ?? 0
    if (counted + len >= target) {
      const range = document.createRange()
      range.setStart(node, Math.min(len, Math.max(0, target - counted)))
      range.collapse(true)
      const rects = range.getClientRects()
      const box = rects.length > 0 ? rects[0] : range.getBoundingClientRect()
      if (!box || (box.height === 0 && box.width === 0)) break
      return box.top - paraEl.getBoundingClientRect().top
    }
    counted += len
  }
  return null
}

/** Scroll mode: place the content anchor at the vertical center of the clip. */
export function scrollViewportToRatio(
  viewport: HTMLElement,
  index: WordIndex,
  ratio: number,
): void {
  if (index.ids.length === 0) {
    viewport.scrollTop = 0
    return
  }

  const max = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
  const r = clampRatio(ratio)
  if (r <= 0.005) {
    viewport.scrollTop = 0
    return
  }
  if (r >= 0.995) {
    viewport.scrollTop = max
    return
  }

  const { paraIndex, frac } = anchorFromRatio(r, index)
  const id = index.ids[paraIndex]
  const paraEl = viewport.querySelector(
    `[data-para-id="${CSS.escape(id)}"]`,
  ) as HTMLElement | null
  if (!paraEl) {
    viewport.scrollTop = r * max
    return
  }

  const viewTop = viewport.getBoundingClientRect().top
  const paraTop =
    paraEl.getBoundingClientRect().top - viewTop + viewport.scrollTop
  const caretY = caretOffsetYInParagraph(paraEl, frac)
  const anchorY =
    caretY != null
      ? paraTop + caretY
      : paraTop + frac * (paraEl.offsetHeight || 0)
  viewport.scrollTop = scrollTopForCenterAnchor(
    anchorY,
    viewport.clientHeight,
    max,
  )
}
