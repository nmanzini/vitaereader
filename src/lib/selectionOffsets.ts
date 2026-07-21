/**
 * Map a DOM Selection to plain-text offsets inside `[data-para-id]` paragraphs.
 * `<br>` counts as `\n` so poem offsets match `paragraph.text`.
 */

export type ParaSelection = {
  paraId: string
  paraEl: HTMLElement
  start: number
  end: number
  text: string
}

/** Multi-paragraph selection (one contiguous DOM Range across reader paras). */
export type WorkSelection = {
  /** Ordered paragraph slices covered by the selection. */
  segments: ParaSelection[]
  /** Joined plain text (paragraphs separated by `\n\n`). */
  text: string
  /** First segment — used for share deep-links. */
  primary: ParaSelection
}

export type SelectionPoint = {
  paraId: string
  offset: number
}

export type SerializedSelection = {
  start: SelectionPoint
  end: SelectionPoint
}

/** Plain length of a subtree (BR → 1). */
export function plainTextLength(root: Node): number {
  if (root.nodeType === Node.TEXT_NODE) return root.textContent?.length ?? 0
  if (root.nodeType !== Node.ELEMENT_NODE) return 0
  const el = root as Element
  if (el.tagName === 'BR') return 1
  let n = 0
  for (const child of root.childNodes) n += plainTextLength(child)
  return n
}

/**
 * Offset of (node, offset) in root’s plain text, counting BR as `\n`.
 * For Element containers, `offset` is a child index (DOM Range rules).
 */
export function plainOffsetInElement(
  root: Element,
  node: Node,
  offset: number,
): number | null {
  if (!root.contains(node) && node !== root) return null

  let count = 0
  let found = false

  function walk(current: Node): void {
    if (found) return

    if (current === node) {
      if (current.nodeType === Node.TEXT_NODE) {
        count += Math.min(offset, current.textContent?.length ?? 0)
        found = true
        return
      }
      if (current.nodeType === Node.ELEMENT_NODE) {
        const kids = current.childNodes
        const lim = Math.min(offset, kids.length)
        for (let i = 0; i < lim; i++) count += plainTextLength(kids[i]!)
        found = true
        return
      }
    }

    if (current.nodeType === Node.TEXT_NODE) {
      count += current.textContent?.length ?? 0
      return
    }
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element
      if (el.tagName === 'BR') {
        count += 1
        return
      }
      for (const child of current.childNodes) {
        walk(child)
        if (found) return
      }
    }
  }

  walk(root)
  return found ? count : null
}

/** Inverse of plainOffsetInElement — DOM point for a plain offset. */
export function domPointFromPlainOffset(
  root: Element,
  target: number,
): { node: Node; offset: number } | null {
  if (target < 0) return null
  let remaining = target

  function walk(current: Node): { node: Node; offset: number } | null {
    if (current.nodeType === Node.TEXT_NODE) {
      const len = current.textContent?.length ?? 0
      if (remaining <= len) return { node: current, offset: remaining }
      remaining -= len
      return null
    }
    if (current.nodeType !== Node.ELEMENT_NODE) return null
    const el = current as Element
    if (el.tagName === 'BR') {
      if (remaining === 0) {
        const parent = el.parentNode
        if (!parent) return null
        return {
          node: parent,
          offset: Array.prototype.indexOf.call(parent.childNodes, el),
        }
      }
      remaining -= 1
      return null
    }
    for (const child of current.childNodes) {
      const hit = walk(child)
      if (hit) return hit
    }
    return null
  }

  if (target === 0 && root.childNodes.length === 0) {
    return { node: root, offset: 0 }
  }
  const hit = walk(root)
  if (hit) return hit
  // Clamp to end of paragraph.
  const len = plainTextLength(root)
  if (target >= len) {
    // Walk to absolute end.
    remaining = len
    return walk(root) ?? { node: root, offset: root.childNodes.length }
  }
  return null
}

function paraElFromNode(node: Node | null): HTMLElement | null {
  if (!node) return null
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement
  return (el?.closest('[data-para-id]') as HTMLElement | null) ?? null
}

function slicePara(
  paraEl: HTMLElement,
  start: number,
  end: number,
): ParaSelection | null {
  const paraId = paraEl.getAttribute('data-para-id')
  if (!paraId || end <= start) return null
  const full = plainTextLength(paraEl)
  const a = Math.max(0, Math.min(start, full))
  const b = Math.max(0, Math.min(end, full))
  if (b <= a) return null
  // Reconstruct via range when possible for accurate text.
  const startPt = domPointFromPlainOffset(paraEl, a)
  const endPt = domPointFromPlainOffset(paraEl, b)
  let text = ''
  if (startPt && endPt) {
    const range = document.createRange()
    range.setStart(startPt.node, startPt.offset)
    range.setEnd(endPt.node, endPt.offset)
    text = range.toString()
  }
  return { paraId, paraEl, start: a, end: b, text }
}

/** Resolve the current selection if it lies entirely within one reader paragraph. */
export function selectionInParagraph(
  root: ParentNode | null = document,
): ParaSelection | null {
  const work = readWorkSelection(root)
  if (!work || work.segments.length !== 1) return null
  return work.primary
}

/**
 * Resolve a selection that may span multiple reader paragraphs
 * (same column flow / multi-page columns still share one DOM tree).
 */
export function readWorkSelection(
  root: ParentNode | null = document,
): WorkSelection | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null

  const range = sel.getRangeAt(0)
  if (!range || range.collapsed) return null

  const startPara = paraElFromNode(range.startContainer)
  const endPara = paraElFromNode(range.endContainer)
  if (!startPara || !endPara) return null
  if (root instanceof Element) {
    if (!root.contains(startPara) || !root.contains(endPara)) return null
  }

  const startOff = plainOffsetInElement(
    startPara,
    range.startContainer,
    range.startOffset,
  )
  const endOff = plainOffsetInElement(
    endPara,
    range.endContainer,
    range.endOffset,
  )
  if (startOff == null || endOff == null) return null

  if (startPara === endPara) {
    const one = slicePara(startPara, startOff, endOff)
    if (!one || !one.text.trim()) return null
    return { segments: [one], text: one.text, primary: one }
  }

  // Walk paragraphs in document order between start and end.
  const shell =
    (root instanceof Element ? root : startPara.closest('.reader-shell')) ??
    document
  const paras = Array.from(
    shell.querySelectorAll<HTMLElement>('[data-para-id]'),
  )
  const i0 = paras.indexOf(startPara)
  const i1 = paras.indexOf(endPara)
  if (i0 < 0 || i1 < 0 || i1 < i0) return null

  const segments: ParaSelection[] = []
  for (let i = i0; i <= i1; i++) {
    const el = paras[i]!
    const len = plainTextLength(el)
    const a = i === i0 ? startOff : 0
    const b = i === i1 ? endOff : len
    const slice = slicePara(el, a, b)
    if (slice) segments.push(slice)
  }
  if (segments.length === 0) return null
  const text = segments.map((s) => s.text).join('\n\n')
  if (!text.trim()) return null
  return { segments, text, primary: segments[0]! }
}

/** Snapshot selection as paragraph offsets (survives column transforms). */
export function serializeSelection(
  root: ParentNode | null = document,
): SerializedSelection | null {
  const work = readWorkSelection(root)
  if (!work) return null
  const first = work.segments[0]!
  const last = work.segments[work.segments.length - 1]!
  return {
    start: { paraId: first.paraId, offset: first.start },
    end: { paraId: last.paraId, offset: last.end },
  }
}

function findPara(
  root: ParentNode,
  paraId: string,
): HTMLElement | null {
  const esc =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(paraId)
      : paraId.replace(/["\\]/g, '\\$&')
  return root.querySelector(`[data-para-id="${esc}"]`)
}

/** Re-apply a serialized selection after a page turn / layout shift. */
export function restoreSelection(
  root: ParentNode,
  snap: SerializedSelection,
): boolean {
  const startEl = findPara(root, snap.start.paraId)
  const endEl = findPara(root, snap.end.paraId)
  if (!startEl || !endEl) return false
  const startPt = domPointFromPlainOffset(startEl, snap.start.offset)
  const endPt = domPointFromPlainOffset(endEl, snap.end.offset)
  if (!startPt || !endPt) return false
  try {
    const range = document.createRange()
    range.setStart(startPt.node, startPt.offset)
    range.setEnd(endPt.node, endPt.offset)
    const sel = window.getSelection()
    if (!sel) return false
    sel.removeAllRanges()
    sel.addRange(range)
    return !sel.isCollapsed
  } catch {
    return false
  }
}

/**
 * Extend the active selection’s focus to the caret under (x, y).
 * Used after multi-page edge advance while the finger is still down.
 */
export function extendSelectionToClientPoint(x: number, y: number): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false

  let focusNode: Node | null = null
  let focusOffset = 0

  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null
  }

  if (typeof doc.caretRangeFromPoint === 'function') {
    const caret = doc.caretRangeFromPoint(x, y)
    if (!caret) return false
    focusNode = caret.startContainer
    focusOffset = caret.startOffset
  } else if (typeof doc.caretPositionFromPoint === 'function') {
    const caret = doc.caretPositionFromPoint(x, y)
    if (!caret) return false
    focusNode = caret.offsetNode
    focusOffset = caret.offset
  } else {
    return false
  }

  if (!paraElFromNode(focusNode)) return false

  try {
    // Prefer Selection.extend when available (preserves anchor).
    if (typeof sel.extend === 'function') {
      sel.extend(focusNode, focusOffset)
      return !sel.isCollapsed
    }
    const anchorNode = sel.anchorNode
    const anchorOffset = sel.anchorOffset
    if (!anchorNode) return false
    const range = document.createRange()
    range.setStart(anchorNode, anchorOffset)
    range.setEnd(focusNode, focusOffset)
    if (range.collapsed) {
      range.setStart(focusNode, focusOffset)
      range.setEnd(anchorNode, anchorOffset)
    }
    sel.removeAllRanges()
    sel.addRange(range)
    return !sel.isCollapsed
  } catch {
    return false
  }
}

/** Client rect for positioning a selection toolbar (prefer last visible line). */
export function selectionToolbarAnchor(): DOMRect | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  const rects = range.getClientRects()
  // Prefer a rect that is on-screen (multi-page selection spans off-screen cols).
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i]!
    if (r.width <= 0 && r.height <= 0) continue
    if (r.bottom < 0 || r.top > window.innerHeight) continue
    if (r.right < 0 || r.left > window.innerWidth) continue
    return r
  }
  if (rects.length > 0) {
    const last = rects[rects.length - 1]!
    if (last.width > 0 || last.height > 0) return last
  }
  const box = range.getBoundingClientRect()
  if (box.width === 0 && box.height === 0) return null
  return box
}

export function clearWindowSelection() {
  const sel = window.getSelection()
  sel?.removeAllRanges()
}

/** True when the user has a non-collapsed text selection. */
export function hasTextSelection(): boolean {
  const sel = window.getSelection()
  return !!sel && !sel.isCollapsed && (sel.toString().length ?? 0) > 0
}
